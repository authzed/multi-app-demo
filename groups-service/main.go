package main

import (
	"context"
	"database/sql"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"strconv"
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
	ID          int      `json:"id" db:"id"`
	Name        string   `json:"name" db:"name"`
	Description string   `json:"description" db:"description"`
	Email       string   `json:"email" db:"email"`
	Visibility  string   `json:"visibility" db:"visibility"`
	Owners      []string `json:"owners"`
	CreatedAt   string   `json:"created_at" db:"created_at"`
}

type CreateGroupRequest struct {
	Name          string `json:"name" binding:"required"`
	Description   string `json:"description"`
	Email         string `json:"email"`
	Visibility    string `json:"visibility"`
	OwnerUsername string `json:"owner_username" binding:"required"`
}

var (
	db            *sql.DB
	spicedbClient *authzed.Client
)

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

	// Create some test relationships for existing groups
	rows, err := db.Query(`
		SELECT g.id, gm.username, gm.role 
		FROM groups g 
		JOIN group_memberships gm ON g.id = gm.group_id
	`)
	if err != nil {
		log.Printf("Failed to fetch existing groups for SpiceDB init: %v", err)
		return
	}
	defer rows.Close()

	var updates []*v1.RelationshipUpdate
	for rows.Next() {
		var groupID int
		var username, role string
		err := rows.Scan(&groupID, &username, &role)
		if err != nil {
			log.Printf("Failed to scan group membership: %v", err)
			continue
		}

		var relation string
		switch role {
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
					ObjectId:   fmt.Sprintf("%d", groupID),
				},
				Relation: relation,
				Subject: &v1.SubjectReference{
					Object: &v1.ObjectReference{
						ObjectType: "user",
						ObjectId:   username,
					},
				},
			},
		})
	}

	if len(updates) > 0 {
		_, err = spicedbClient.WriteRelationships(context.Background(), &v1.WriteRelationshipsRequest{
			Updates: updates,
		})
		if err != nil {
			log.Printf("Failed to initialize SpiceDB relationships: %v", err)
		} else {
			log.Printf("Initialized %d SpiceDB relationships", len(updates))
		}
	}
}

func checkPermission(username string, groupID int, permission string) bool {
	resp, err := spicedbClient.CheckPermission(context.Background(), &v1.CheckPermissionRequest{
		Resource: &v1.ObjectReference{
			ObjectType: "group",
			ObjectId:   fmt.Sprintf("%d", groupID),
		},
		Permission: permission,
		Subject: &v1.SubjectReference{
			Object: &v1.ObjectReference{
				ObjectType: "user",
				ObjectId:   username,
			},
		},
	})
	if err != nil {
		log.Printf("SpiceDB permission check failed: %v", err)
		return false
	}
	return resp.Permissionship == v1.CheckPermissionResponse_PERMISSIONSHIP_HAS_PERMISSION
}

func addSpiceDBRelationship(groupID int, username string, role string) error {
	var relation string
	switch role {
	case "OWNER", "MANAGER":
		relation = "admin"
	case "MEMBER":
		relation = "member"
	default:
		return fmt.Errorf("invalid role: %s", role)
	}

	_, err := spicedbClient.WriteRelationships(context.Background(), &v1.WriteRelationshipsRequest{
		Updates: []*v1.RelationshipUpdate{
			{
				Operation: v1.RelationshipUpdate_OPERATION_CREATE,
				Relationship: &v1.Relationship{
					Resource: &v1.ObjectReference{
						ObjectType: "group",
						ObjectId:   fmt.Sprintf("%d", groupID),
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
	})
	return err
}

func removeSpiceDBRelationship(groupID int, username string) error {
	// Remove both admin and member relationships
	updates := []*v1.RelationshipUpdate{
		{
			Operation: v1.RelationshipUpdate_OPERATION_DELETE,
			Relationship: &v1.Relationship{
				Resource: &v1.ObjectReference{
					ObjectType: "group",
					ObjectId:   fmt.Sprintf("%d", groupID),
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
					ObjectId:   fmt.Sprintf("%d", groupID),
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

	_, err := spicedbClient.WriteRelationships(context.Background(), &v1.WriteRelationshipsRequest{
		Updates: updates,
	})
	return err
}

func deleteSpiceDBGroup(groupID int) error {
	// Delete all relationships for this group
	filter := &v1.RelationshipFilter{
		ResourceType:       "group",
		OptionalResourceId: fmt.Sprintf("%d", groupID),
	}

	_, err := spicedbClient.DeleteRelationships(context.Background(), &v1.DeleteRelationshipsRequest{
		RelationshipFilter: filter,
	})
	return err
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
		SELECT g.id, g.name, g.description, g.email, g.visibility, g.created_at 
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
		err := rows.Scan(
			&group.ID, &group.Name, &group.Description, &group.Email,
			&group.Visibility, &createdAt,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to scan group"})
			return
		}
		group.CreatedAt = createdAt.Format("2006-01-02 15:04:05")

		// Fetch owners for this group
		owners, err := getGroupOwners(group.ID)
		if err != nil {
			log.Printf("Failed to fetch owners for group %d: %v", group.ID, err)
			group.Owners = []string{}
		} else {
			group.Owners = owners
		}

		groups = append(groups, group)
	}

	c.JSON(http.StatusOK, groups)
}

func getGroupOwners(groupID int) ([]string, error) {
	rows, err := db.Query(`
		SELECT username 
		FROM group_memberships 
		WHERE group_id = $1 AND role = 'OWNER'
		ORDER BY username
	`, groupID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var owners []string
	for rows.Next() {
		var username string
		err := rows.Scan(&username)
		if err != nil {
			return nil, err
		}
		owners = append(owners, username)
	}

	return owners, nil
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

	// Use provided email or generate from name
	var email string
	if req.Email != "" {
		email = req.Email
	} else {
		// Generate email from name (replace spaces with hyphens and make lowercase)
		emailPrefix := strings.ToLower(strings.ReplaceAll(req.Name, " ", "-"))
		email = fmt.Sprintf("%s@company.com", emailPrefix)
	}

	var groupID int
	err := db.QueryRow(`
		INSERT INTO groups (name, description, email, visibility) 
		VALUES ($1, $2, $3, $4) 
		RETURNING id
	`, req.Name, req.Description, email, req.Visibility).Scan(&groupID)
	if err != nil {
		log.Printf("Failed to create group: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create group"})
		return
	}

	// Add creator as owner in memberships
	_, err = db.Exec(`
		INSERT INTO group_memberships (group_id, username, role) 
		VALUES ($1, $2, 'OWNER')
	`, groupID, req.OwnerUsername)
	if err != nil {
		log.Printf("Failed to add creator as owner: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add creator as owner"})
		return
	}

	// Add relationship to SpiceDB
	err = addSpiceDBRelationship(groupID, req.OwnerUsername, "OWNER")
	if err != nil {
		log.Printf("Failed to add SpiceDB relationship for group %d: %v", groupID, err)
	}

	// Fetch the created group
	var group Group
	var createdAt time.Time
	err = db.QueryRow(`
		SELECT id, name, description, email, visibility, created_at 
		FROM groups WHERE id = $1
	`, groupID).Scan(
		&group.ID, &group.Name, &group.Description, &group.Email,
		&group.Visibility, &createdAt,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch created group"})
		return
	}

	group.CreatedAt = createdAt.Format("2006-01-02 15:04:05")

	// Fetch owners for the created group
	owners, err := getGroupOwners(groupID)
	if err != nil {
		log.Printf("Failed to fetch owners for created group %d: %v", groupID, err)
		group.Owners = []string{req.OwnerUsername} // fallback to creator
	} else {
		group.Owners = owners
	}

	c.JSON(http.StatusCreated, group)
}

func getGroupMembers(c *gin.Context) {
	groupIDStr := c.Param("id")
	groupID, err := strconv.Atoi(groupIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid group ID"})
		return
	}

	// Check permission to view members
	username := c.GetHeader("X-Username")
	if username == "" || !checkPermission(username, groupID, "view_members") {
		c.JSON(http.StatusForbidden, gin.H{"error": "Permission denied"})
		return
	}

	rows, err := db.Query(`
		SELECT username, role 
		FROM group_memberships 
		WHERE group_id = $1 
		ORDER BY role, username
	`, groupID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch group members"})
		return
	}
	defer rows.Close()

	type Member struct {
		Username string `json:"username"`
		Role     string `json:"role"`
	}

	var members []Member
	for rows.Next() {
		var member Member
		err := rows.Scan(&member.Username, &member.Role)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to scan member"})
			return
		}
		members = append(members, member)
	}

	c.JSON(http.StatusOK, members)
}

func addGroupMember(c *gin.Context) {
	groupIDStr := c.Param("id")
	groupID, err := strconv.Atoi(groupIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid group ID"})
		return
	}

	// Check permission to add members
	username := c.GetHeader("X-Username")
	if username == "" || !checkPermission(username, groupID, "add_member") {
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

	// Check if group exists
	var exists bool
	err = db.QueryRow("SELECT EXISTS(SELECT 1 FROM groups WHERE id = $1)", groupID).Scan(&exists)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check group existence"})
		return
	}

	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Group not found"})
		return
	}

	// Add member to group
	_, err = db.Exec(`
		INSERT INTO group_memberships (group_id, username, role) 
		VALUES ($1, $2, $3)
		ON CONFLICT (group_id, username) 
		DO UPDATE SET role = EXCLUDED.role
	`, groupID, req.Username, req.Role)
	if err != nil {
		log.Printf("Failed to add member to group %d: %v", groupID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add member to group"})
		return
	}

	// Add relationship to SpiceDB
	err = addSpiceDBRelationship(groupID, req.Username, req.Role)
	if err != nil {
		log.Printf("Failed to add SpiceDB relationship for user %s in group %d: %v", req.Username, groupID, err)
	}

	c.JSON(http.StatusOK, gin.H{"message": "Member added successfully"})
}

func removeGroupMember(c *gin.Context) {
	groupIDStr := c.Param("id")
	memberUsername := c.Param("username")

	groupID, err := strconv.Atoi(groupIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid group ID"})
		return
	}

	// Check permission to add members (same permission for removing)
	requesterUsername := c.GetHeader("X-Username")
	if requesterUsername == "" || !checkPermission(requesterUsername, groupID, "add_member") {
		c.JSON(http.StatusForbidden, gin.H{"error": "Permission denied"})
		return
	}

	// Remove member from group
	result, err := db.Exec(`
		DELETE FROM group_memberships 
		WHERE group_id = $1 AND username = $2
	`, groupID, memberUsername)
	if err != nil {
		log.Printf("Failed to remove member from group %d: %v", groupID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove member from group"})
		return
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check operation result"})
		return
	}

	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Member not found in group"})
		return
	}

	// Remove relationship from SpiceDB
	err = removeSpiceDBRelationship(groupID, memberUsername)
	if err != nil {
		log.Printf("Failed to remove SpiceDB relationship for user %s in group %d: %v", memberUsername, groupID, err)
	}

	c.JSON(http.StatusOK, gin.H{"message": "Member removed successfully"})
}

func deleteGroup(c *gin.Context) {
	groupIDStr := c.Param("id")
	groupID, err := strconv.Atoi(groupIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid group ID"})
		return
	}

	// Check permission to delete group
	username := c.GetHeader("X-Username")
	if username == "" || !checkPermission(username, groupID, "delete") {
		c.JSON(http.StatusForbidden, gin.H{"error": "Permission denied"})
		return
	}

	// Check if group exists
	var exists bool
	err = db.QueryRow("SELECT EXISTS(SELECT 1 FROM groups WHERE id = $1)", groupID).Scan(&exists)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check group existence"})
		return
	}

	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Group not found"})
		return
	}

	// Delete the group (CASCADE will handle memberships and messages)
	_, err = db.Exec("DELETE FROM groups WHERE id = $1", groupID)
	if err != nil {
		log.Printf("Failed to delete group %d: %v", groupID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete group"})
		return
	}

	// Clean up SpiceDB relationships
	err = deleteSpiceDBGroup(groupID)
	if err != nil {
		log.Printf("Failed to clean up SpiceDB relationships for group %d: %v", groupID, err)
	}

	log.Printf("Group %d deleted successfully", groupID)
	c.JSON(http.StatusOK, gin.H{"message": "Group deleted successfully"})
}

func main() {
	initDB()
	defer db.Close()
	initSpiceDB()

	r := gin.Default()
	r.Use(corsMiddleware())

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "healthy", "service": "groups"})
	})

	r.GET("/groups", getGroups)
	r.POST("/groups", createGroup)
	r.DELETE("/groups/:id", deleteGroup)
	r.GET("/groups/:id/members", getGroupMembers)
	r.POST("/groups/:id/members", addGroupMember)
	r.DELETE("/groups/:id/members/:username", removeGroupMember)

	log.Println("Groups service starting on port 3001")
	r.Run(":3001")
}
