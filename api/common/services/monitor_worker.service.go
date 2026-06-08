package services

import(
   "time"
   "context"
   "sync"
   "log"
   "github.com/CuesoftCloud/upstat/repositories"
   "github.com/CuesoftCloud/upstat/models"
   "github.com/CuesoftCloud/upstat/config"
)

type MonitorWorker struct{
	MonitorRepo repositories.MonitorRepository
	CheckResultRepo repositories.CheckResultRepository
    IncidentRepo repositories.IncidentRepository
	Concurrency int
	PollInterval time.Duration
}

func NewMonitorWorker (db *config.DB) *MonitorWorker {
	return &MonitorWorker{
		MonitorRepo: repositories.NewMonitorRepository(db),
		CheckResultRepo: repositories.NewCheckResultRepository(db),
        IncidentRepo: repositories.NewIncidentRepository(db),
        Concurrency: 10,
		PollInterval: 5*time.Second,
	}
}

func (w * MonitorWorker) Start (ctx context.Context){
	ticker := time.NewTicker(w.PollInterval)
	defer ticker.Stop()
}

func (w * MonitorWorker) runOnce(){
	monitors, err := w.MonitorRepo.ListActiveMonitors()
	if err != nil{
	 log.Println("could not list active monitors")
	 return
	}


    sem := make(chan struct{}, w.Concurrency)
	var wg sync.WaitGroup

	for _, monitor := range monitors{
		if !shouldRunMonitor(monitor){
			continue
		}
	}

	wg.Add(1)
	sem <- struct{}{}

	go func (m *models.Monitor){
		defer wg.Done()
		defer func(){<-sem}()

		if err := w.processMonitor(m)
		err != nil{
			log.Println("monitor check failed", err)
		}
	}(monitor)

	wg.Wait()

}

func shouldRunMonitor(monitor *models.Monitor) bool {
    if monitor.LastCheckedAt == nil{
		return true
	}

	interval := time.Duration(monitor.IntervalSeconds) * time.Second
	if interval <= 0{
		interval = 60 * time.Second
	}

	return time.Since(*monitor.LastCheckedAt) >= interval

}
