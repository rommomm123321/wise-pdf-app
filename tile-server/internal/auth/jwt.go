package auth

import (
	"fmt"

	"github.com/golang-jwt/jwt/v5"
)

// JWTAuth validates JWT tokens using the shared secret with Express
type JWTAuth struct {
	secret []byte
}

func NewJWTAuth(secret string) *JWTAuth {
	return &JWTAuth{secret: []byte(secret)}
}

// ValidateToken parses and validates a JWT token, returns userId
func (a *JWTAuth) ValidateToken(tokenString string) (string, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return a.secret, nil
	})
	if err != nil {
		return "", fmt.Errorf("invalid token: %w", err)
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok || !token.Valid {
		return "", fmt.Errorf("invalid token claims")
	}

	userId, ok := claims["userId"].(string)
	if !ok {
		return "", fmt.Errorf("userId not found in token")
	}

	return userId, nil
}
