package main

import (
	"context"
	"database/sql"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	v1 "github.com/authzed/authzed-go/proto/authzed/api/v1"
	"github.com/authzed/authzed-go/v1"
	"github.com/authzed/grpcutil"
	"github.com/gin-gonic/gin"
	_ "github.com/lib/pq"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

type Group struct {
	Username    string   `json:"username" db:"username"`
	Name        string   `json:"name" db:"name"`
	Description string   `json:"description" db:"description"`
	Email       string   `json:"email"`
	Visibility  string   `json:"visibility" db:"visibility"`
	Zedtoken    string   `json:"zedtoken,omitempty" db:"zedtoken"`
	Owners      []string `json:"owners"`
	CreatedAt   string   `json:"created_at" db:"created_at"`
}

type CreateGroupRequest struct {
	Username      string `json:"username" binding:"required"`
	Name          string `json:"name" binding:"required"`
	Description   string `json:"description"`
	Visibility    string `json:"visibility"`
	OwnerUsername string `json:"owner_username" binding:"required"`
}

type User struct {
	ID       int    `json:"id"`
	Name     string `json:"name"`
	Username string `json:"username"`
	Color    string `json:"color"`
}

var (
	db            *sql.DB
	spicedbClient *authzed.Client
)

// Hardcoded users list - source of truth for all users in the system
var systemUsers = []User{
	{ID: 1, Name: "Alex Chen", Username: "achen", Color: "#e74c3c"},
	{ID: 2, Name: "Jordan Rivera", Username: "jrivera", Color: "#3498db"},
	{ID: 3, Name: "Taylor Kim", Username: "tkim", Color: "#2ecc71"},
	{ID: 4, Name: "Casey Morgan", Username: "cmorgan", Color: "#f39c12"},
	{ID: 5, Name: "Riley Thompson", Username: "rthompson", Color: "#9b59b6"},
}

func initSpiceDB() {
	spicedbEndpoint := os.Getenv("SPICEDB_ENDPOINT")
	if spicedbEndpoint == "" {
		spicedbEndpoint = "localhost:50051"
	}

	spicedbToken := os.Getenv("SPICEDB_TOKEN")
	if spicedbToken == "" {
		spicedbToken = "testtesttesttest"
	}

	// Wait for SpiceDB to be ready
	for i := 0; i < 30; i++ {
		client, err := authzed.NewClient(spicedbEndpoint, grpc.WithTransportCredentials(insecure.NewCredentials()),
			grpcutil.WithInsecureBearerToken(spicedbToken))
		if err != nil {
			log.Printf("Failed to connect to SpiceDB: %v", err)
			time.Sleep(2 * time.Second)
			continue
		}
		_, err = client.CheckPermission(context.Background(), &v1.CheckPermissionRequest{
			Resource: &v1.ObjectReference{
				ObjectType: "group",
				ObjectId:   "test",
			},
			Permission: "view_members",
			Subject: &v1.SubjectReference{
				Object: &v1.ObjectReference{
					ObjectType: "user",
					ObjectId:   "test",
				},
			},
		})
		if err == nil || strings.Contains(err.Error(), "object_not_found") {
			spicedbClient = client
			log.Println("SpiceDB connected successfully")
			break
		}
	}

	if spicedbClient == nil {
		log.Fatal("Failed to connect to SpiceDB")
	}

	initializeTestData()
}

func initializeTestData() {
	log.Println("Initializing SpiceDB test data...")

	// Create hardcoded test relationships for sample groups
	// This replaces the previous database-driven initialization
	testMemberships := []struct {
		groupUsername string
		username      string
		role          string
	}{
		{"engineering", "achen", "OWNER"},
		{"engineering", "jrivera", "MEMBER"},
		{"engineering", "tkim", "MEMBER"},
		{"product", "achen", "OWNER"},
		{"product", "cmorgan", "MEMBER"},
		{"product", "rthompson", "MEMBER"},
	}

	var updates []*v1.RelationshipUpdate
	for _, membership := range testMemberships {
		var relation string
		switch membership.role {
		case "OWNER", "MANAGER":
			relation = "admin"
		case "MEMBER":
			relation = "member"
		default:
			continue
		}

		updates = append(updates, &v1.RelationshipUpdate{
			Operation: v1.RelationshipUpdate_OPERATION_CREATE,
			Relationship: &v1.Relationship{
				Resource: &v1.ObjectReference{
					ObjectType: "group",
					ObjectId:   membership.groupUsername,
				},
				Relation: relation,
				Subject: &v1.SubjectReference{
					Object: &v1.ObjectReference{
						ObjectType: "user",
						ObjectId:   membership.username,
					},
				},
			},
		})
	}

	if len(updates) > 0 {
		request := &v1.WriteRelationshipsRequest{
			Updates: updates,
		}

		// Log the SpiceDB initialization request
		log.Printf("[SPICEDB] operation=WriteRelationships context=initialization update_count=%d", len(updates))
		for i, update := range updates {
			log.Printf("[SPICEDB] operation=WriteRelationships context=initialization update=%d action=%s resource_type=%s resource_id=%s relation=%s subject_type=%s subject_id=%s",
				i+1,
				update.Operation.String(),
				update.Relationship.Resource.ObjectType,
				update.Relationship.Resource.ObjectId,
				update.Relationship.Relation,
				update.Relationship.Subject.Object.ObjectType,
				update.Relationship.Subject.Object.ObjectId)
		}

		resp, err := spicedbClient.WriteRelationships(context.Background(), request)
		if err != nil {
			log.Printf("[SPICEDB] operation=WriteRelationships context=initialization status=ERROR error=%v", err)
		} else {
			log.Printf("[SPICEDB] operation=WriteRelationships context=initialization status=SUCCESS written_at=%s update_count=%d", resp.WrittenAt.Token, len(updates))

			// Store zedtokens for both test groups
			for _, groupUsername := range []string{"engineering", "product"} {
				if err := storeGroupZedtoken(groupUsername, resp.WrittenAt.Token); err != nil {
					log.Printf("Warning: Failed to store initial zedtoken for group %s: %v", groupUsername, err)
				}
			}
		}
	}
}

func checkPermission(username string, groupUsername string, permission string) bool {
	request := &v1.CheckPermissionRequest{
		Resource: &v1.ObjectReference{
			ObjectType: "group",
			ObjectId:   groupUsername,
		},
		Permission: permission,
		Subject: &v1.SubjectReference{
			Object: &v1.ObjectReference{
				ObjectType: "user",
				ObjectId:   username,
			},
		},
		Consistency: getConsistencyForGroup(groupUsername),
	}

	// Log the SpiceDB check request parameters
	log.Printf("[SPICEDB] operation=CheckPermission resource_type=%s resource_id=%s permission=%s subject_type=%s subject_id=%s",
		request.Resource.ObjectType, request.Resource.ObjectId, request.Permission,
		request.Subject.Object.ObjectType, request.Subject.Object.ObjectId)

	resp, err := spicedbClient.CheckPermission(context.Background(), request)
	if err != nil {
		log.Printf("[SPICEDB] operation=CheckPermission status=ERROR error=%v", err)
		return false
	}

	// Log the response
	log.Printf("[SPICEDB] operation=CheckPermission status=SUCCESS permissionship=%s", resp.Permissionship.String())

	return resp.Permissionship == v1.CheckPermissionResponse_PERMISSIONSHIP_HAS_PERMISSION
}

func addSpiceDBRelationship(groupUsername string, username string, role string) error {
	var relation string
	switch role {
	case "OWNER", "MANAGER":
		relation = "admin"
	case "MEMBER":
		relation = "member"
	default:
		return fmt.Errorf("invalid role: %s", role)
	}

	request := &v1.WriteRelationshipsRequest{
		Updates: []*v1.RelationshipUpdate{
			{
				Operation: v1.RelationshipUpdate_OPERATION_CREATE,
				Relationship: &v1.Relationship{
					Resource: &v1.ObjectReference{
						ObjectType: "group",
						ObjectId:   groupUsername,
					},
					Relation: relation,
					Subject: &v1.SubjectReference{
						Object: &v1.ObjectReference{
							ObjectType: "user",
							ObjectId:   username,
						},
					},
				},
			},
		},
	}

	// Log the SpiceDB write request parameters
	log.Printf("[SPICEDB] operation=WriteRelationships action=CREATE resource_type=group resource_id=%s relation=%s subject_type=user subject_id=%s",
		groupUsername, relation, username)

	resp, err := spicedbClient.WriteRelationships(context.Background(), request)
	if err != nil {
		log.Printf("[SPICEDB] operation=WriteRelationships status=ERROR error=%v", err)
		return err
	}

	// Log the response and store zedtoken
	log.Printf("[SPICEDB] operation=WriteRelationships status=SUCCESS written_at=%s", resp.WrittenAt.Token)

	// Store the zedtoken for future consistency
	if err := storeGroupZedtoken(groupUsername, resp.WrittenAt.Token); err != nil {
		log.Printf("Warning: Failed to store zedtoken for group %s: %v", groupUsername, err)
		// Don't fail the operation if zedtoken storage fails
	}

	return nil
}

func removeSpiceDBRelationship(groupUsername string, username string) error {
	// Remove both admin and member relationships
	updates := []*v1.RelationshipUpdate{
		{
			Operation: v1.RelationshipUpdate_OPERATION_DELETE,
			Relationship: &v1.Relationship{
				Resource: &v1.ObjectReference{
					ObjectType: "group",
					ObjectId:   groupUsername,
				},
				Relation: "admin",
				Subject: &v1.SubjectReference{
					Object: &v1.ObjectReference{
						ObjectType: "user",
						ObjectId:   username,
					},
				},
			},
		},
		{
			Operation: v1.RelationshipUpdate_OPERATION_DELETE,
			Relationship: &v1.Relationship{
				Resource: &v1.ObjectReference{
					ObjectType: "group",
					ObjectId:   groupUsername,
				},
				Relation: "member",
				Subject: &v1.SubjectReference{
					Object: &v1.ObjectReference{
						ObjectType: "user",
						ObjectId:   username,
					},
				},
			},
		},
	}

	request := &v1.WriteRelationshipsRequest{
		Updates: updates,
	}

	// Log the SpiceDB write request parameters
	log.Printf("[SPICEDB] operation=WriteRelationships action=DELETE resource_type=group resource_id=%s subject_type=user subject_id=%s relations=admin,member", groupUsername, username)

	resp, err := spicedbClient.WriteRelationships(context.Background(), request)
	if err != nil {
		log.Printf("[SPICEDB] operation=WriteRelationships status=ERROR error=%v", err)
		return err
	}

	// Log the response and store zedtoken
	log.Printf("[SPICEDB] operation=WriteRelationships status=SUCCESS written_at=%s", resp.WrittenAt.Token)

	// Store the zedtoken for future consistency
	if err := storeGroupZedtoken(groupUsername, resp.WrittenAt.Token); err != nil {
		log.Printf("Warning: Failed to store zedtoken for group %s: %v", groupUsername, err)
		// Don't fail the operation if zedtoken storage fails
	}

	return nil
}

func deleteSpiceDBGroup(groupUsername string) error {
	// Delete all relationships for this group
	filter := &v1.RelationshipFilter{
		ResourceType:       "group",
		OptionalResourceId: groupUsername,
	}

	request := &v1.DeleteRelationshipsRequest{
		RelationshipFilter: filter,
	}

	// Log the SpiceDB delete request parameters
	log.Printf("[SPICEDB] operation=DeleteRelationships resource_type=group resource_id=%s", groupUsername)

	resp, err := spicedbClient.DeleteRelationships(context.Background(), request)
	if err != nil {
		log.Printf("[SPICEDB] operation=DeleteRelationships status=ERROR error=%v", err)
		return err
	}

	// Log the response and store zedtoken
	log.Printf("[SPICEDB] operation=DeleteRelationships status=SUCCESS deleted_at=%s", resp.DeletedAt.Token)

	// Store the zedtoken for future consistency
	if err := storeGroupZedtoken(groupUsername, resp.DeletedAt.Token); err != nil {
		log.Printf("Warning: Failed to store zedtoken for group %s: %v", groupUsername, err)
		// Don't fail the operation if zedtoken storage fails
	}

	return nil
}

func initDB() {
	var err error
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		databaseURL = "postgres://demo:demo123@localhost:5432/groups_db?sslmode=disable"
	}

	// Wait for database to be ready
	for i := 0; i < 30; i++ {
		db, err = sql.Open("postgres", databaseURL)
		if err == nil {
			err = db.Ping()
			if err == nil {
				break
			}
		}
		log.Printf("Database not ready, retrying in 2 seconds... (%d/30)", i+1)
		time.Sleep(2 * time.Second)
	}

	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	// Run schema initialization
	schema, err := ioutil.ReadFile("schema.sql")
	if err != nil {
		log.Fatal("Failed to read schema file:", err)
	}

	_, err = db.Exec(string(schema))
	if err != nil {
		log.Fatal("Failed to initialize database schema:", err)
	}

	log.Println("Database connected and schema initialized")
}

func logMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		raw := c.Request.URL.RawQuery

		// Process request
		c.Next()

		// Log request
		end := time.Now()
		latency := end.Sub(start)

		clientIP := c.ClientIP()
		method := c.Request.Method
		statusCode := c.Writer.Status()

		if raw != "" {
			path = path + "?" + raw
		}

		log.Printf("[HTTP] method=%s path=%s status=%d latency=%v ip=%s",
			method, path, statusCode, latency, clientIP)
	}
}

func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Username")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	}
}

func getGroups(c *gin.Context) {
	rows, err := db.Query(`
		SELECT g.username, g.name, g.description, g.visibility, g.zedtoken, g.created_at 
		FROM groups g 
		ORDER BY g.created_at DESC
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch groups"})
		return
	}
	defer rows.Close()

	var groups []Group
	for rows.Next() {
		var group Group
		var createdAt time.Time
		var zedtoken sql.NullString
		err := rows.Scan(
			&group.Username, &group.Name, &group.Description,
			&group.Visibility, &zedtoken, &createdAt,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to scan group"})
			return
		}
		group.CreatedAt = createdAt.Format("2006-01-02 15:04:05")
		group.Email = fmt.Sprintf("%s@company.com", group.Username)
		if zedtoken.Valid {
			group.Zedtoken = zedtoken.String
		}

		// Fetch owners for this group from SpiceDB
		owners, err := getGroupOwnersFromSpiceDB(group.Username)
		if err != nil {
			log.Printf("Failed to fetch owners for group %s: %v", group.Username, err)
			group.Owners = []string{}
		} else {
			group.Owners = owners
		}

		groups = append(groups, group)
	}

	c.JSON(http.StatusOK, groups)
}

// Helper function to check if a username is taken by a system user
func isSystemUser(username string) bool {
	for _, user := range systemUsers {
		if user.Username == username {
			return true
		}
	}
	return false
}

// Helper function to validate that a username doesn't conflict with existing groups or users
func validateUsername(username string) error {
	// Check if it conflicts with system users
	if isSystemUser(username) {
		return fmt.Errorf("username '%s' conflicts with an existing user", username)
	}

	// Check if it conflicts with existing groups
	var exists bool
	err := db.QueryRow("SELECT EXISTS(SELECT 1 FROM groups WHERE username = $1)", username).Scan(&exists)
	if err != nil {
		return fmt.Errorf("failed to check existing groups: %v", err)
	}
	if exists {
		return fmt.Errorf("username '%s' conflicts with an existing group", username)
	}

	return nil
}

// Zedtoken management functions

// Store zedtoken for a group after SpiceDB mutations
func storeGroupZedtoken(groupUsername, zedtoken string) error {
	_, err := db.Exec(`
		UPDATE groups 
		SET zedtoken = $1, updated_at = CURRENT_TIMESTAMP 
		WHERE username = $2
	`, zedtoken, groupUsername)
	if err != nil {
		log.Printf("Failed to store zedtoken for group %s: %v", groupUsername, err)
		return err
	}
	log.Printf("Stored zedtoken for group %s: %s", groupUsername, zedtoken)
	return nil
}

// Get consistency requirement for a group based on stored zedtoken
func getConsistencyForGroup(groupUsername string) *v1.Consistency {
	var zedtoken sql.NullString
	err := db.QueryRow(`
		SELECT zedtoken 
		FROM groups 
		WHERE username = $1
	`, groupUsername).Scan(&zedtoken)
	if err != nil {
		log.Printf("Failed to get zedtoken for group %s, using immediate consistency: %v", groupUsername, err)
		return &v1.Consistency{
			Requirement: &v1.Consistency_FullyConsistent{
				FullyConsistent: true,
			},
		}
	}

	if zedtoken.Valid {
		log.Printf("Using AtLeastAsFresh consistency for group %s with zedtoken: %s", groupUsername, zedtoken.String)
		return &v1.Consistency{
			Requirement: &v1.Consistency_AtLeastAsFresh{
				AtLeastAsFresh: &v1.ZedToken{Token: zedtoken.String},
			},
		}
	}

	log.Printf("No zedtoken for group %s, using immediate consistency", groupUsername)
	return &v1.Consistency{
		Requirement: &v1.Consistency_FullyConsistent{
			FullyConsistent: true,
		},
	}
}

// SpiceDB query functions to read relationships

// Get all members of a group from SpiceDB
func getGroupMembersFromSpiceDB(groupUsername string) ([]map[string]string, error) {
	// Query SpiceDB for subjects that have any relation to the group
	request := &v1.ReadRelationshipsRequest{
		RelationshipFilter: &v1.RelationshipFilter{
			ResourceType:       "group",
			OptionalResourceId: groupUsername,
		},
		Consistency: getConsistencyForGroup(groupUsername),
	}

	log.Printf("[SPICEDB] operation=ReadRelationships resource_type=group resource_id=%s", groupUsername)

	stream, err := spicedbClient.ReadRelationships(context.Background(), request)
	if err != nil {
		log.Printf("[SPICEDB] operation=ReadRelationships status=ERROR error=%v", err)
		return nil, err
	}

	var members []map[string]string
	for {
		response, err := stream.Recv()
		if err != nil {
			if err.Error() == "EOF" {
				break
			}
			log.Printf("[SPICEDB] operation=ReadRelationships status=ERROR error=%v", err)
			return nil, err
		}

		rel := response.Relationship
		if rel.Subject.Object.ObjectType == "user" {
			// Map SpiceDB relations to roles
			role := "MEMBER"
			if rel.Relation == "admin" {
				role = "OWNER" // In our schema, admin includes both OWNER and MANAGER
			}

			members = append(members, map[string]string{
				"username": rel.Subject.Object.ObjectId,
				"role":     role,
			})
		}
	}

	log.Printf("[SPICEDB] operation=ReadRelationships status=SUCCESS member_count=%d", len(members))
	return members, nil
}

// Get owners of a group from SpiceDB
func getGroupOwnersFromSpiceDB(groupUsername string) ([]string, error) {
	request := &v1.ReadRelationshipsRequest{
		RelationshipFilter: &v1.RelationshipFilter{
			ResourceType:       "group",
			OptionalResourceId: groupUsername,
			OptionalRelation:   "admin", // Only get admin relationships (which include owners)
		},
		Consistency: getConsistencyForGroup(groupUsername),
	}

	log.Printf("[SPICEDB] operation=ReadRelationships resource_type=group resource_id=%s relation=admin", groupUsername)

	stream, err := spicedbClient.ReadRelationships(context.Background(), request)
	if err != nil {
		log.Printf("[SPICEDB] operation=ReadRelationships status=ERROR error=%v", err)
		return nil, err
	}

	var owners []string
	for {
		response, err := stream.Recv()
		if err != nil {
			if err.Error() == "EOF" {
				break
			}
			log.Printf("[SPICEDB] operation=ReadRelationships status=ERROR error=%v", err)
			return nil, err
		}

		rel := response.Relationship
		if rel.Subject.Object.ObjectType == "user" {
			owners = append(owners, rel.Subject.Object.ObjectId)
		}
	}

	log.Printf("[SPICEDB] operation=ReadRelationships status=SUCCESS owner_count=%d", len(owners))
	return owners, nil
}

// Public API endpoint to get all system users
func getUsers(c *gin.Context) {
	c.JSON(http.StatusOK, systemUsers)
}

// Public API endpoint to get all registered groups (basic info only)
func getPublicGroups(c *gin.Context) {
	rows, err := db.Query(`
		SELECT username, name, description, visibility, created_at 
		FROM groups 
		WHERE visibility IN ('PUBLIC', 'RESTRICTED')
		ORDER BY created_at DESC
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch public groups"})
		return
	}
	defer rows.Close()

	type PublicGroup struct {
		Username    string `json:"username"`
		Name        string `json:"name"`
		Description string `json:"description"`
		Email       string `json:"email"`
		Visibility  string `json:"visibility"`
		CreatedAt   string `json:"created_at"`
	}

	var groups []PublicGroup
	for rows.Next() {
		var group PublicGroup
		var createdAt time.Time
		err := rows.Scan(
			&group.Username, &group.Name, &group.Description,
			&group.Visibility, &createdAt,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to scan group"})
			return
		}
		group.CreatedAt = createdAt.Format("2006-01-02 15:04:05")
		group.Email = fmt.Sprintf("%s@company.com", group.Username)

		groups = append(groups, group)
	}

	c.JSON(http.StatusOK, groups)
}

func createGroup(c *gin.Context) {
	var req CreateGroupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Default values
	if req.Visibility == "" {
		req.Visibility = "PUBLIC"
	}

	// Validate username doesn't conflict with users or existing groups
	if err := validateUsername(req.Username); err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		return
	}

	// Validate that the owner is a valid system user
	if !isSystemUser(req.OwnerUsername) {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Owner username '%s' is not a valid system user", req.OwnerUsername)})
		return
	}

	// Insert the group
	_, err := db.Exec(`
		INSERT INTO groups (username, name, description, visibility) 
		VALUES ($1, $2, $3, $4)
	`, req.Username, req.Name, req.Description, req.Visibility)
	if err != nil {
		log.Printf("Failed to create group: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create group"})
		return
	}

	// Add creator as owner in SpiceDB (SpiceDB is the sole source of truth)
	err = addSpiceDBRelationship(req.Username, req.OwnerUsername, "OWNER")
	if err != nil {
		log.Printf("Failed to add SpiceDB relationship for group %s: %v", req.Username, err)
		// Don't fail the request if SpiceDB fails, but log it
	}

	// Fetch the created group
	var group Group
	var createdAt time.Time
	var zedtoken sql.NullString
	err = db.QueryRow(`
		SELECT username, name, description, visibility, zedtoken, created_at 
		FROM groups WHERE username = $1
	`, req.Username).Scan(
		&group.Username, &group.Name, &group.Description,
		&group.Visibility, &zedtoken, &createdAt,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch created group"})
		return
	}

	group.CreatedAt = createdAt.Format("2006-01-02 15:04:05")
	group.Email = fmt.Sprintf("%s@company.com", group.Username)
	if zedtoken.Valid {
		group.Zedtoken = zedtoken.String
	}

	// Fetch owners for the created group from SpiceDB
	owners, err := getGroupOwnersFromSpiceDB(req.Username)
	if err != nil {
		log.Printf("Failed to fetch owners for created group %s: %v", req.Username, err)
		group.Owners = []string{req.OwnerUsername} // fallback to creator
	} else {
		group.Owners = owners
	}

	c.JSON(http.StatusCreated, group)
}

func getGroupMembers(c *gin.Context) {
	groupUsername := c.Param("username")

	// Check permission to view members
	username := c.GetHeader("X-Username")
	if username == "" || !checkPermission(username, groupUsername, "view_members") {
		c.JSON(http.StatusForbidden, gin.H{"error": "Permission denied"})
		return
	}

	// Fetch members from SpiceDB
	memberData, err := getGroupMembersFromSpiceDB(groupUsername)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch group members"})
		return
	}

	type Member struct {
		Username string `json:"username"`
		Role     string `json:"role"`
	}

	var members []Member
	for _, memberInfo := range memberData {
		members = append(members, Member{
			Username: memberInfo["username"],
			Role:     memberInfo["role"],
		})
	}

	c.JSON(http.StatusOK, members)
}

func addGroupMember(c *gin.Context) {
	groupUsername := c.Param("username")

	// Check permission to add members
	username := c.GetHeader("X-Username")
	if username == "" || !checkPermission(username, groupUsername, "add_member") {
		c.JSON(http.StatusForbidden, gin.H{"error": "Permission denied"})
		return
	}

	type AddMemberRequest struct {
		Username string `json:"username" binding:"required"`
		Role     string `json:"role" binding:"required"`
	}

	var req AddMemberRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate role
	if req.Role != "OWNER" && req.Role != "MANAGER" && req.Role != "MEMBER" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid role. Must be OWNER, MANAGER, or MEMBER"})
		return
	}

	// Validate that the user being added is a valid system user
	if !isSystemUser(req.Username) {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Username '%s' is not a valid system user", req.Username)})
		return
	}

	// Check if group exists
	var exists bool
	err := db.QueryRow("SELECT EXISTS(SELECT 1 FROM groups WHERE username = $1)", groupUsername).Scan(&exists)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check group existence"})
		return
	}

	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Group not found"})
		return
	}

	// Add member to group in SpiceDB (SpiceDB is the sole source of truth)
	err = addSpiceDBRelationship(groupUsername, req.Username, req.Role)
	if err != nil {
		log.Printf("Failed to add SpiceDB relationship for user %s in group %s: %v", req.Username, groupUsername, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add member to group"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Member added successfully"})
}

func removeGroupMember(c *gin.Context) {
	groupUsername := c.Param("username")
	memberUsername := c.Param("memberusername")

	// Check permission to add members (same permission for removing)
	requesterUsername := c.GetHeader("X-Username")
	if requesterUsername == "" || !checkPermission(requesterUsername, groupUsername, "add_member") {
		c.JSON(http.StatusForbidden, gin.H{"error": "Permission denied"})
		return
	}

	// Remove member from group in SpiceDB (SpiceDB is the sole source of truth)
	err := removeSpiceDBRelationship(groupUsername, memberUsername)
	if err != nil {
		log.Printf("Failed to remove SpiceDB relationship for user %s in group %s: %v", memberUsername, groupUsername, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove member from group"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Member removed successfully"})
}

func deleteGroup(c *gin.Context) {
	groupUsername := c.Param("username")

	// Check permission to delete group
	username := c.GetHeader("X-Username")
	if username == "" || !checkPermission(username, groupUsername, "delete") {
		c.JSON(http.StatusForbidden, gin.H{"error": "Permission denied"})
		return
	}

	// Check if group exists
	var exists bool
	err := db.QueryRow("SELECT EXISTS(SELECT 1 FROM groups WHERE username = $1)", groupUsername).Scan(&exists)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check group existence"})
		return
	}

	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Group not found"})
		return
	}

	// Delete the group (CASCADE will handle memberships and messages)
	_, err = db.Exec("DELETE FROM groups WHERE username = $1", groupUsername)
	if err != nil {
		log.Printf("Failed to delete group %s: %v", groupUsername, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete group"})
		return
	}

	// Clean up SpiceDB relationships
	err = deleteSpiceDBGroup(groupUsername)
	if err != nil {
		log.Printf("Failed to clean up SpiceDB relationships for group %s: %v", groupUsername, err)
	}

	log.Printf("Group %s deleted successfully", groupUsername)
	c.JSON(http.StatusOK, gin.H{"message": "Group deleted successfully"})
}

func main() {
	initDB()
	defer db.Close()
	initSpiceDB()

	// Disable Gin's default logger and use our custom one
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(logMiddleware())
	r.Use(corsMiddleware())

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "healthy", "service": "groups"})
	})

	// Public API endpoints
	r.GET("/api/users", getUsers)
	r.GET("/api/groups", getPublicGroups)

	r.GET("/groups", getGroups)
	r.POST("/groups", createGroup)
	r.DELETE("/groups/:username", deleteGroup)
	r.GET("/groups/:username/members", getGroupMembers)
	r.POST("/groups/:username/members", addGroupMember)
	r.DELETE("/groups/:username/members/:memberusername", removeGroupMember)

	log.Println("Groups service starting on port 3001")
	r.Run(":3001")
}
