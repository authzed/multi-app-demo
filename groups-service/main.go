package main

import (
	"database/sql"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	_ "github.com/lib/pq"
)

type Group struct {
	Username    string   `json:"username" db:"username"`
	Name        string   `json:"name" db:"name"`
	Description string   `json:"description" db:"description"`
	Email       string   `json:"email"`
	Visibility  string   `json:"visibility" db:"visibility"`
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
	db *sql.DB
)

// Hardcoded users list - source of truth for all users in the system
var systemUsers = []User{
	{ID: 1, Name: "Alex Chen", Username: "achen", Color: "#e74c3c"},
	{ID: 2, Name: "Jordan Rivera", Username: "jrivera", Color: "#3498db"},
	{ID: 3, Name: "Taylor Kim", Username: "tkim", Color: "#2ecc71"},
	{ID: 4, Name: "Casey Morgan", Username: "cmorgan", Color: "#f39c12"},
	{ID: 5, Name: "Riley Thompson", Username: "rthompson", Color: "#9b59b6"},
}


func initializeTestData() {
	log.Println("Initializing test data...")

	// Create hardcoded test memberships for sample groups  
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

	// Insert memberships into database
	for _, membership := range testMemberships {
		_, err := db.Exec(`
			INSERT INTO group_members (group_username, member_username, role) 
			VALUES ($1, $2, $3) 
			ON CONFLICT (group_username, member_username) DO UPDATE SET role = $3
		`, membership.groupUsername, membership.username, membership.role)
		if err != nil {
			log.Printf("Warning: Failed to insert membership %s -> %s: %v", membership.username, membership.groupUsername, err)
		}
	}
	
	log.Println("Test data initialization completed")
}

// Database helper functions for simple membership tracking

func getGroupOwnersFromDB(groupUsername string) ([]string, error) {
	rows, err := db.Query(`
		SELECT member_username FROM group_members 
		WHERE group_username = $1 AND role = 'OWNER'
	`, groupUsername)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var owners []string
	for rows.Next() {
		var owner string
		if err := rows.Scan(&owner); err != nil {
			return nil, err
		}
		owners = append(owners, owner)
	}
	return owners, nil
}

func getGroupMembersFromDB(groupUsername string) ([]map[string]string, error) {
	rows, err := db.Query(`
		SELECT member_username, role FROM group_members 
		WHERE group_username = $1 ORDER BY role DESC, member_username
	`, groupUsername)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var members []map[string]string
	for rows.Next() {
		var username, role string
		if err := rows.Scan(&username, &role); err != nil {
			return nil, err
		}
		members = append(members, map[string]string{
			"username": username,
			"role":     role,
		})
	}
	return members, nil
}

func addMemberToDB(groupUsername, username, role string) error {
	_, err := db.Exec(`
		INSERT INTO group_members (group_username, member_username, role) 
		VALUES ($1, $2, $3) 
		ON CONFLICT (group_username, member_username) 
		DO UPDATE SET role = $3, created_at = CURRENT_TIMESTAMP
	`, groupUsername, username, role)
	return err
}

func removeMemberFromDB(groupUsername, username string) error {
	_, err := db.Exec(`
		DELETE FROM group_members 
		WHERE group_username = $1 AND member_username = $2
	`, groupUsername, username)
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
		SELECT g.username, g.name, g.description, g.visibility, g.created_at 
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
			&group.Username, &group.Name, &group.Description,
			&group.Visibility, &createdAt,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to scan group"})
			return
		}
		group.CreatedAt = createdAt.Format("2006-01-02 15:04:05")
		group.Email = fmt.Sprintf("%s@company.com", group.Username)

		// Fetch owners for this group from database
		owners, err := getGroupOwnersFromDB(group.Username)
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

	// Add creator as owner in database
	err = addMemberToDB(req.Username, req.OwnerUsername, "OWNER")
	if err != nil {
		log.Printf("Failed to add member to database for group %s: %v", req.Username, err)
		// Don't fail the request if member addition fails, but log it
	}

	// Fetch the created group
	var group Group
	var createdAt time.Time
	err = db.QueryRow(`
		SELECT username, name, description, visibility, created_at 
		FROM groups WHERE username = $1
	`, req.Username).Scan(
		&group.Username, &group.Name, &group.Description,
		&group.Visibility, &createdAt,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch created group"})
		return
	}

	group.CreatedAt = createdAt.Format("2006-01-02 15:04:05")
	group.Email = fmt.Sprintf("%s@company.com", group.Username)

	// Fetch owners for the created group from database
	owners, err := getGroupOwnersFromDB(req.Username)
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

	// Fetch members from database - no permission checks in simplified version
	memberData, err := getGroupMembersFromDB(groupUsername)
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

	// No permission checks in simplified version
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

	// Add member to group in database
	err = addMemberToDB(groupUsername, req.Username, req.Role)
	if err != nil {
		log.Printf("Failed to add member to database for user %s in group %s: %v", req.Username, groupUsername, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add member to group"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Member added successfully"})
}

func removeGroupMember(c *gin.Context) {
	groupUsername := c.Param("username")
	memberUsername := c.Param("memberusername")

	// No permission checks in simplified version

	// Remove member from group in database
	err := removeMemberFromDB(groupUsername, memberUsername)
	if err != nil {
		log.Printf("Failed to remove member from database for user %s in group %s: %v", memberUsername, groupUsername, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove member from group"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Member removed successfully"})
}

func deleteGroup(c *gin.Context) {
	groupUsername := c.Param("username")

	// No permission checks in simplified version

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

	log.Printf("Group %s deleted successfully", groupUsername)
	c.JSON(http.StatusOK, gin.H{"message": "Group deleted successfully"})
}

func main() {
	initDB()
	defer db.Close()
	initializeTestData()

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
