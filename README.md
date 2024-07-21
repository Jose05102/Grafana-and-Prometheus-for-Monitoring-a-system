# Sistema de Monitoreo con Grafana y Prometheus

Este proyecto muestra cómo configurar un sistema de monitoreo utilizando Grafana y Prometheus para una aplicación Node.js. Se utiliza Docker y Docker-Compose para la implementación.

## Contenidos

1. [Características Principales](#características-principales)
2. [Requisitos Previos](#requisitos-previos)
3. [Instalación](#instalación)
4. [Configuración](#configuración)
5. [Uso](#uso)
6. [Estructura del Proyecto](#estructura-del-proyecto)
7. [Contribuir](#contribuir)
8. [Licencia](#licencia)

## Características Principales

- **Prometheus**: Sistema de monitoreo y alertas que recopila métricas de servicios.
- **Grafana**: Plataforma de visualización de métricas.
- **Node.js**: Aplicación de ejemplo que expone métricas.
- **Docker y Docker-Compose**: Para la implementación y orquestación de servicios.

## Requisitos Previos

- Docker
- Docker-Compose
- Git

## Instalación

### Instalación de Docker y Docker-Compose

1. **Instalar Docker:**
    ```bash
    sudo apt-get update
    sudo apt-get install docker-ce docker-ce-cli containerd.io
    ```

2. **Instalar Docker-Compose:**
    ```bash
    sudo curl -L "https://github.com/docker/compose/releases/download/1.29.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    ```

3. **Verificar la Instalación:**
    ```bash
    docker --version
    docker-compose --version
    ```

### Clonar el Repositorio

1. **Clonar el Repositorio desde GitHub:**
    ```bash
    git clone <URL del repositorio en GitHub>
    cd <nombre del repositorio>
    ```

## Configuración

### Configuración de Prometheus

1. **Archivo `prometheus.yml`:**
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

2. **Configurar Prometheus en Docker Compose:**
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

### Configuración de Grafana

1. **Agregar Grafana en Docker Compose:**
    ```yaml
    grafana:
      image: grafana/grafana
      ports:
        - "3001:3000"
      networks:
        - docker-net
    ```

2. **Agregar Prometheus como Fuente de Datos en Grafana:**
    - Ir a **Configuration > Data Sources** en Grafana.
    - Seleccionar **Add data source** y elegir **Prometheus**.
    - Configurar la URL de Prometheus: `http://prometheus:9090`.

### Integración con el Proyecto Node.js

1. **Instrumentar el Código de Node.js con Métricas:**
    ```javascript
    const express = require('express');
    const bodyParser = require('body-parser');
    const sqlite3 = require('sqlite3').verbose();
    const path = require('path');
    const client = require('prom-client');

    const app = express();
    const port = 3000;

    // Configuración de la base de datos SQLite
    const dbPath = path.join(__dirname, 'registro_db.sqlite3');
    const db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error('Error conectando a la base de datos:', err.message);
            return;
        }
        console.log('Conectado a la base de datos SQLite');
    });

    // Crear tabla si no existe
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

    // Exponer métricas de Prometheus
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

    // Ruta para registrar datos
    app.post('/register', (req, res) => {
        const { fullName, favoriteColor, favoriteSeries } = req.body;
        const query = 'INSERT INTO users (fullName, favoriteColor, favoriteSeries) VALUES (?, ?, ?)';

        db.run(query, [fullName, favoriteColor, favoriteSeries], function(err) {
            if (err) {
                console.error('Error al registrar los datos:', err.message);
                return res.status(500).json({ message: 'Error al registrar los datos' });
            }
            res.json({ message: 'Datos registrados exitosamente', id: this.lastID });
        });
    });

    // Ruta para obtener los datos
    app.get('/data', (req, res) => {
        const query = 'SELECT * FROM users';
        db.all(query, [], (err, rows) => {
            if (err) {
                console.error('Error al obtener los datos:', err.message);
                return res.status(500).json({ message: 'Error al obtener los datos' });
            }
            res.json(rows);
        });
    });

    app.listen(port, () => {
        console.log(`Servidor corriendo en http://localhost:${port}`);
    });
    ```

## Uso

1. **Ejecutar Docker Compose:**
    ```bash
    sudo docker-compose up -d
    ```

2. **Verificar los Targets en Prometheus:**
    - Navega a `http://localhost:9090/targets` y verifica que todos los targets estén `UP`.

3. **Crear Dashboards en Grafana:**
    - Accede a Grafana en `http://localhost:3001`.
    - Crea un nuevo dashboard y añade paneles para visualizar las métricas, como `http_requests_total`.

## Estructura del Proyecto

- `Dockerfile`: Archivo de configuración para construir la imagen Docker de la aplicación Node.js.
- `docker-compose.yml`: Configuración para orquestar servicios Docker (Prometheus, Grafana, Node.js).
- `prometheus.yml`: Configuración de Prometheus para definir los objetivos de monitoreo.
- `server.js`: Código de la aplicación Node.js que expone las métricas para Prometheus.
- `public/`: Archivos estáticos del frontend.
- `registro_db.sqlite3`: Base de datos SQLite de la aplicación.

## Contribuir

Si deseas contribuir a este proyecto, por favor sigue los pasos a continuación:

1. Haz un fork del proyecto.
2. Crea una nueva rama (`git checkout -b feature/nueva-feature`).
3. Haz commit de tus cambios (`git commit -am 'Agregar nueva feature'`).
4. Sube tus cambios a la rama (`git push origin feature/nueva-feature`).
5. Abre un Pull Request.

## Licencia

Este proyecto está bajo la licencia MIT. Consulta el archivo [LICENSE](LICENSE) para más detalles.
