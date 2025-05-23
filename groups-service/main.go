package main

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type Group struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

func main() {
	r := gin.Default()

	r.Use(func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "healthy", "service": "groups"})
	})

	r.GET("/groups", func(c *gin.Context) {
		groups := []Group{
			{ID: "1", Name: "Engineering Team"},
			{ID: "2", Name: "Product Team"},
		}
		c.JSON(http.StatusOK, groups)
	})

	r.POST("/groups", func(c *gin.Context) {
		var group Group
		if err := c.ShouldBindJSON(&group); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusCreated, group)
	})

	r.Run(":3001")
}
