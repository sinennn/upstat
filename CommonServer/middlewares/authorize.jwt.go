package middlewares

import (
	"net/http"
	"strings"

	"github.com/CuesoftCloud/upstat/utils"
	"github.com/gin-gonic/gin"
)

func AuthorizeJWT() gin.HandlerFunc {
	return func(c *gin.Context) {
		const BearerSchema = "Bearer "

		authHeader := c.GetHeader("Authorization")

		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}

		if !strings.HasPrefix(authHeader, BearerSchema) {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid Authorization Header"})
			return
		}

		tokenString := authHeader[len(BearerSchema):]
		userID, email, err := utils.ValidateToken(tokenString)

		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid Token"})
			return
		} else {
			c.Set("userId", userID)
			c.Set("email", email)
		}
	}
}
