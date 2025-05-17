const { SMTPServer } = require("smtp-server");
const { simpleParser } = require('mailparser');
const Database = require('better-sqlite3');
const express = require('express');
const fs = require('fs');

const API_PASSWORD = 'TarikulOnTop12!';
const SMTP_PORT = 25;
const API_PORT = 3000;

const db = new Database('emails.db');

db.exec(`
    CREATE TABLE IF NOT EXISTS emails (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_email TEXT,
        to_email TEXT,
        subject TEXT,
        text TEXT,
        html TEXT,
        date_received DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

const insertEmail = db.prepare(`
    INSERT INTO emails (from_email, to_email, subject, text, html)
    VALUES (@from_email, @to_email, @subject, @text, @html)
`);

const server = new SMTPServer({
    allowInsecureAuth: true,
    authOptional: true,
    onConnect(session, callback) {
        console.log(`onConnect`, session.id);
        callback();
    },
    onMailFrom(address, session, callback) {
        console.log(`onMailFrom`, address.address, session.id);
        callback();
    },
    onRcptTo(address, session, callback) {
        console.log(`onRcptTo`, address.address, session.id);
        callback();
    },
    onData(stream, session, callback) {
        simpleParser(stream, (err, parsed) => {
            if (err) {
                console.error('Error parsing email:', err);
                return callback(err);
            }

            try {
                insertEmail.run({
                    from_email: parsed.from.text,
                    to_email: parsed.to.text,
                    subject: parsed.subject,
                    text: parsed.text,
                    html: parsed.html
                });
                console.log('Email saved to database.');
            } catch (e) {
                console.error('Failed to save email:', e);
            }

            callback();
        });
    }
});

server.listen(SMTP_PORT, () => {
    console.log(`SMTP server active on ${SMTP_PORT}`);
});

const app = express();

app.use((req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: Missing Authorization header' });
    }

    const token = authHeader.split(' ')[1];
    if (token !== API_PASSWORD) {
        return res.status(403).json({ error: 'Forbidden: Invalid API password' });
    }

    next();
});

app.get('/emails/:email', (req, res) => {
    const email = req.params.email;
    const stmt = db.prepare(`SELECT * FROM emails WHERE to_email LIKE ? ORDER BY date_received DESC`);
    const rows = stmt.all(`%${email}%`);
    res.json(rows);
});

app.get('/emails', (req, res) => {
    const stmt = db.prepare(`SELECT * FROM emails ORDER BY date_received DESC`);
    const rows = stmt.all();
    res.json(rows);
});

app.listen(API_PORT, '0.0.0.0', () => {
    console.log(`API server active on http://0.0.0.0:${API_PORT}`);
});
