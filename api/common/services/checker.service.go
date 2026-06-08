package services

import (
	"context"
	"net/http"
	"time"
	"github.com/CuesoftCloud/upstat/models"
)

type checkExecutionResult struct{
	Status string
	StatusCode int
	ResponseTimeMs int64
	Error string
}

func ExecuteHttpCheck (monitor *models.Monitor) checkExecutionResult {
	timeout := time.Duration(monitor.TimeoutSeconds) * time.Second
	if timeout <= 0{
		timeout = 10* time.Second
	}

	client := &http.Client{Timeout : timeout}

    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, monitor.Target, nil)
	if err != nil{
		return checkExecutionResult{Status: "down", Error: err.Error()}
	}

	start := time.Now()
	resp, err := client.Do(req)
	responseTime := time.Since(start).Milliseconds()

	if err != nil{
		return checkExecutionResult{Status:"down", ResponseTimeMs:responseTime, Error:err.Error()}
	}

	defer resp.Body.Close()

	status := "up"
	if resp.StatusCode < 200 || resp.StatusCode >= 400{
		status = "down"
	}

	return checkExecutionResult{Status: status,
								StatusCode: resp.StatusCode,
								ResponseTimeMs:responseTime,
								Error: err.Error(),
			                   }	   
}