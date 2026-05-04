const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// Allow CORS from bench host(s)
const io = new Server(server, {
  cors: {
    origin: [
      'http://localhost:8000',
      'http://cron.localhost:8000',
      'http://127.0.0.1:8000'
    ],
    methods: ['GET', 'POST']
  }
});

io.on('connection', (socket) => {
  console.log('socket connected:', socket.id);
  socket.on('authenticate', (data) => {
    console.log('auth attempt', data);
    // Validate token with the server-side endpoint
    try {
      const http = require('http');
      const qs = require('querystring');
      const params = qs.stringify({ session_name: data.session_name, token: data.token });
      const options = {
        hostname: 'cron.localhost',
        port: 8000,
        path: '/api/method/cron_remote.api.validate_socket_token?' + params,
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      };

      const req = http.request(options, (res) => {
        let buf = '';
        res.setEncoding('utf8');
        res.on('data', chunk => buf += chunk);
        res.on('end', () => {
          try {
            const body = JSON.parse(buf);
            const ok = body.message === true || body._server_messages?.length === 0 && body.message !== false;
            if (body.message === true) {
              socket.data.session_name = data.session_name;
              socket.data.role = data.role;
              socket.data.token = data.token;
              socket.emit('auth_ok');
              console.log('socket auth validated ok for', data.session_name);
            } else {
              socket.emit('auth_failed');
              console.log('socket auth failed for', data.session_name, body);
            }
          } catch (e) {
            console.error('error parsing validate response', e, buf);
            socket.emit('auth_failed');
          }
        });
      });

      req.on('error', (err) => {
        console.error('validate request error', err);
        socket.emit('auth_failed');
      });

      req.end();
    } catch (e) {
      console.error('validate token exception', e);
      socket.emit('auth_failed');
    }
  });

  socket.on('rr_event', (payload) => {
    // payload = { session, event }
    console.log('rr_event', payload.session, payload.event && payload.event.type);
    // Broadcast to all admin sockets — in prod use rooms/namespaces and proper auth
    io.emit('remote_session_event', payload);
  });

  socket.on('disconnect', (reason) => {
    console.log('socket disconnected', socket.id, reason);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Socket server listening on', PORT));
