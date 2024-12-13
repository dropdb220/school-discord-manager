import Discord from 'discord.js';
import express from 'express';
import bodyParser from 'body-parser';
import verify from '../bot/verify';
import unverify from '../bot/unverify';

const app = express();

app.use(bodyParser.urlencoded({ extended: true }))

export default async function startServer(client: Discord.Client) {
    app.post('/authuser', (req, res) => {
        if (!req.socket.remoteAddress?.includes('127.0.0.1') && req.socket.remoteAddress !== '::1') {
            res.status(401).send('Unauthorized');
            return;
        }
        if (req.headers.authorization !== process.env.AUTHORIZATION) {
            res.status(401).send('Unauthorized');
            return;
        }
        if (req.body.id == null) {
            res.status(400).send('Bad Request');
            return;
        }
        verify(client, req.body.id);
        res.status(200).send('OK');
    });
    app.post('/deauthuser', (req, res) => {
        if (!req.socket.remoteAddress?.includes('127.0.0.1') && req.socket.remoteAddress !== '::1') {
            res.status(401).send('Unauthorized');
            return;
        }
        if (req.headers.authorization !== process.env.AUTHORIZATION) {
            res.status(401).send('Unauthorized');
            return;
        }
        if (req.body.id == null) {
            res.status(400).send('Bad Request');
            return;
        }
        unverify(client, req.body.id);
        res.status(200).send('OK');
    });
    app.listen(process.env.PORT, () => {
        console.log('Server started on port', process.env.PORT);
    });
}