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
