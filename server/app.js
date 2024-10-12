
const express = require('express');
const session = require('express-session');
const authRoutes = require('./routes/auth');
const sequelize = require('./config/db');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');


//const {WebSocketServer} = require('ws');

const app = express();
const port = 5000;
const userSockets = new Map();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/*
app.use(session({
    secret: 'mysecret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));

 */

const sessionMiddleware = session({
    secret: 'mysecret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
});

app.use(sessionMiddleware);

sequelize.sync().then(() => {
    console.log('Synchronizacja z bazą danych zakończona');
});

app.use('/auth', authRoutes);

app.get('/dashboard', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/auth/login');
    }

    res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});

app.get('/api/posts', async (req, res) => {
    try {
        const [results, metadata] = await sequelize.query('SELECT * FROM posts');
        res.status(200).json(results);
    } catch (error) {
        console.error('Error fetching posts:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


app.use(express.static(path.join(__dirname, 'client/build')));


app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});

const server = http.createServer(app);


const wss = new WebSocket.Server({ server });

const wrap = middleware => (ws, req, next) => middleware(req, {}, next);

/*
wss.on('connection', (ws, req) => {
    if (req.session && req.session.user) {

        const username = req.session.user.username;
        console.log(`WebSocket: użytkownik ${username} połączony`);


        userSockets.set(username, ws);

        ws.on('message', (message) => {
            console.log(`Otrzymano wiadomość od użytkownika ${username}: ${message}`);


            const targetUsername = extractTargetUsername(message);


            const targetSocket = userSockets.get(targetUsername);
            if (targetSocket && targetSocket.readyState === WebSocket.OPEN) {
                targetSocket.send(`Wiadomość od użytkownika ${username}: ${message}`);
            }
        });

        ws.on('close', () => {
            console.log(`WebSocket: użytkownik ${username} rozłączony`);
            userSockets.delete(username);
        });
    }
});


 */

wss.on('connection', (ws, req) => {
    wrap(sessionMiddleware)(ws, req, () => {
        if (req.session && req.session.user) {
            const username = req.session.user.username;
            console.log(`WebSocket: użytkownik ${username} połączony`);

            userSockets.set(username, ws);

            ws.on('message', (message) => {
                console.log(` ${username}: ${message}`);

                const targetUsername = extractTargetUsername(message);
                if (!targetUsername) {
                    ws.send('Błąd: nie podano odbiorcy.');
                    return;
                }

                const targetSocket = userSockets.get(targetUsername);
                if (targetSocket && targetSocket.readyState === WebSocket.OPEN) {
                    const parsedMessage = JSON.parse(message);
                    targetSocket.send(`${username}: ${parsedMessage.message}`);
                } else {
                    ws.send(`Użytkownik ${targetUsername} nie jest dostępny.`);
                }
            });

            ws.on('close', () => {
                console.log(`WebSocket: użytkownik ${username} rozłączony`);
                userSockets.delete(username);
            });
        } else {
            ws.close();
        }
    });
});



/*
function extractTargetUsername(message) {
    try {
        const parsedMessage = JSON.parse(message);
        return parsedMessage.targetUsername;
    } catch (e) {
        console.error('Błąd parsowania wiadomości:', e);
        return null;
    }
}

 */


function extractTargetUsername(message) {
    try {
        const parsedMessage = JSON.parse(message);
        return parsedMessage.targetUsername;
    } catch (e) {
        console.error('Błąd parsowania wiadomości:', e);
        return null;
    }
}






server.listen(port, () => {
    console.log(`Serwer działa na porcie ${port}`);
});