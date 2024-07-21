# Monitoring System with Grafana and Prometheus

This project demonstrates how to set up a monitoring system using Grafana and Prometheus for a Node.js application. Docker and Docker-Compose are used for deployment.

## Contents

1. [Key Features](#key-features)
2. [Prerequisites](#prerequisites)
3. [Installation](#installation)
4. [Configuration](#configuration)
5. [Usage](#usage)
6. [Project Structure](#project-structure)
7. [Contributing](#contributing)
8. [License](#license)

## Key Features

- **Prometheus**: Monitoring and alerting system that collects metrics from services.
- **Grafana**: Metrics visualization platform.
- **Node.js**: Sample application exposing metrics.
- **Docker and Docker-Compose**: For deployment and service orchestration.

## Prerequisites

- Docker
- Docker-Compose
- Git

## Installation

### Installing Docker and Docker-Compose

1. **Install Docker:**
    ```bash
    sudo apt update
    sudo apt upgrade
    sudo apt install docker.io
    sudo systemctl start docker
    sudo systemctl enable docker
    sudo usermod -aG docker $USER
    ```

2. **Install Docker-Compose:**
    ```bash
    sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    docker-compose --version
    ```

3. **Verify Installation:**
    ```bash
    docker --version
    docker-compose --version
    ```

### Clone the Repository

1. **Clone the repository from GitHub:**
    ```bash
    sudo git clone git@github.com:Jose05102/Grafana-and-Prometheus-for-Monitoring-a-system.git
    cd Grafana-and-Prometheus-for-Monitoring-a-system
    ```

## Configuration

### Prometheus Configuration

1. **`prometheus.yml` file:**
    ```yaml
    global:
      scrape_interval: 15s
      evaluation_interval: 15s

    scrape_configs:
      - job_name: "prometheus"
        static_configs:
          - targets: ["localhost:9090"]

      - job_name: "cadvisor"
        static_configs:
          - targets: ["cadvisor:8080"]

      - job_name: "node_exporter"
        static_configs:
          - targets: ["node_exporter:9100"]

      - job_name: "node_app"
        static_configs:
          - targets: ["node-app:3000"]
    ```

2. **Configure Prometheus in Docker Compose:**
    ```yaml
    version: '3'
    services:
      prometheus:
        image: prom/prometheus
        volumes:
          - ./prometheus:/etc/prometheus
        command:
          - '--config.file=/etc/prometheus/prometheus.yml'
        ports:
          - "9090:9090"
        networks:
          - docker-net
    ```

### Grafana Configuration

1. **Add Grafana in Docker Compose:**
    ```yaml
    grafana:
      image: grafana/grafana
      ports:
        - "3001:3000"
      networks:
        - docker-net
    ```

2. **Add Prometheus as a Data Source in Grafana:**
    - Go to **Configuration > Data Sources** in Grafana.
    - Select **Add data source** and choose **Prometheus**.
    - Configure the Prometheus URL: `http://prometheus:9090`.

### Integration with Node.js Project

1. **Instrument Node.js Code with Metrics:**
    ```javascript
    const express = require('express');
    const bodyParser = require('body-parser');
    const sqlite3 = require('sqlite3').verbose();
    const path = require('path');
    const client = require('prom-client');

    const app = express();
    const port = 3000;

    // SQLite database configuration
    const dbPath = path.join(__dirname, 'registro_db.sqlite3');
    const db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error('Error connecting to the database:', err.message);
            return;
        }
        console.log('Connected to the SQLite database');
    });

    // Create table if not exists
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fullName TEXT NOT NULL,
            favoriteColor TEXT NOT NULL,
            favoriteSeries TEXT NOT NULL
        )`);
    });

    // Middleware
    app.use(bodyParser.json());
    app.use(express.static('public'));

    // Expose Prometheus metrics
    const register = new client.Registry();
    const httpRequestsTotal = new client.Counter({
        name: 'http_requests_total',
        help: 'Total number of HTTP requests',
        labelNames: ['method', 'route', 'code']
    });
    register.registerMetric(httpRequestsTotal);

    app.use((req, res, next) => {
        res.on('finish', () => {
            httpRequestsTotal.inc({
                method: req.method,
                route: req.path,
                code: res.statusCode
            });
        });
        next();
    });

    app.get('/metrics', async (req, res) => {
        res.set('Content-Type', register.contentType);
        res.end(await register.metrics());
    });

    // Route to register data
    app.post('/register', (req, res) => {
        const { fullName, favoriteColor, favoriteSeries } = req.body;
        const query = 'INSERT INTO users (fullName, favoriteColor, favoriteSeries) VALUES (?, ?, ?)';

        db.run(query, [fullName, favoriteColor, favoriteSeries], function(err) {
            if (err) {
                console.error('Error registering data:', err.message);
                return res.status(500).json({ message: 'Error registering data' });
            }
            res.json({ message: 'Data successfully registered', id: this.lastID });
        });
    });

    // Route to get data
    app.get('/data', (req, res) => {
        const query = 'SELECT * FROM users';
        db.all(query, [], (err, rows) => {
            if (err) {
                console.error('Error fetching data:', err.message);
                return res.status(500).json({ message: 'Error fetching data' });
            }
            res.json(rows);
        });
    });

    app.listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);
    });
    ```

## Usage

1. **Run Docker Compose:**
    ```bash
    sudo docker network create docker-net
    docker-compose up --build
    ```

2. **Verify Targets in Prometheus:**
    - Navigate to `http://localhost:9090/targets` and ensure all targets are `UP`.

3. **Create Dashboards in Grafana:**
    - Access Grafana at `http://localhost:3001`.
    - Create a new dashboard and add panels to visualize metrics, such as `http_requests_total`.

## Project Structure

- `Dockerfile`: Configuration file to build the Docker image for the Node.js application.
- `docker-compose.yml`: Configuration for orchestrating Docker services (Prometheus, Grafana, Node.js).
- `prometheus.yml`: Prometheus configuration file defining monitoring targets.
- `server.js`: Node.js application code exposing metrics for Prometheus.
- `public/`: Frontend static files.
- `registro_db.sqlite3`: SQLite database for the application.

## Contributing

If you would like to contribute to this project, please follow these steps:

1. Fork the project.
2. Create a new branch (`git checkout -b feature/new-feature`).
3. Commit your changes (`git commit -am 'Add new feature'`).
4. Push your changes to the branch (`git push origin feature/new-feature`).
5. Open a Pull Request.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for more details.
