var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var http = require('http');
var sha256 = require('sha256');
var cors = require('cors');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

var app = express();
const corsConfig = {
    origin: true,
    credentials: true,
};
app.use(cors(corsConfig));

var server = http.createServer(app);
var socketio = require('socket.io');

var mongoose = require('mongoose');
var Chat = require('./models/chat');

server.listen(process.env.PORT || 5050, () => {
    console.log('connected at 5050');
});
var io = socketio(server, {
    handlePreflightRequest: (req, res) => {
        const headers = {
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Allow-Origin": req.headers.origin, //or the specific origin you want to give access to,
            "Access-Control-Allow-Credentials": true
        };
        res.writeHead(200, headers);
        res.end();
    }
});

//mongodb connection
var connect = require('./models');

connect();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');
app.set('trust proxy', true);
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);


/*
방이 있으면 들어가서 실시간 채팅을 하고,
방이 없다면 그 사람 채팅로그 디비에 저장을 해준다.

그리고 그사람이 다시 입장하면 디비에 있는거 들고와서 보여준다.
 */
io.on('connection', (socket) => {
    const chatLog = [];
    var room = '';
    console.log(socket.request.connection._peername.address)
    socket.emit('connected');

    //개인마다 고유한 키를 가지고 방에 입장한다.
    socket.on('requestRoom', (data) => {

        room = sha256(socket.request.connection._peername.address);
        console.log('request room' + room);
        var savedMessages = [];
        Chat.find({room: room}, (err, chats) => {
            if (err) console.log(err);
            else {
                chats.forEach((chat) => {
                    var message = {
                        message: chat.message,
                        alert: false,
                        fromMe: chat.from === chat.room ? true : false
                    }
                    savedMessages.push(message);

                });
                savedMessages.push({
                    message: "채팅서버와 연결되었습니다",
                    alert: true,
                })
                socket.join(room);
                console.log(savedMessages);
                initResult = {
                    id: room,
                    savedMessages: savedMessages,
                }
                io.to(room).emit('id', initResult);

            }
        })

    });

    //채팅 메세지 핸들링
    //db에 저장한다.
    socket.on('chat-msg', (data) => {
        var chat = new Chat();
        chat.room = room;
        chat.message = data.message;
        chat.from = data.name;
        console.log("SAVE");
        chat.save(function (err, chat) {
            if (err) {
                console.log(err);
            }
            console.log("SAVE?");
        });

        io.to(room).emit('chat-msg', data);

    });

    //채팅방에 입장할 수 있다.
    socket.on('joinRoom', (room) => {
        console.log(room);
        savedMessages = [];
        Chat.find({room: room.room}, (err, chats) => {
            if (err) console.log(err);
            else {

                chats.forEach((chat) => {

                    var message = {
                        message: chat.message,
                        alert: false,
                        fromMe: chat.from !== chat.room ? true : false
                    }
                    savedMessages.push(message);

                });
                savedMessages.push({
                    message: "채팅서버와 연결되었습니다",
                    alert: true,
                })
                socket.join(room);
                console.log(savedMessages);
                initResult = {
                    id: 'admin',
                    savedMessages: savedMessages,
                }
                io.to(room).emit('id', initResult);

            }
        })
    })

    //어드민 화면에 전체 채팅방을 들고온다.
    socket.on('getAllRooms', () => {
        console.log("GET ALL");

        socket.join("AdminSocket");
        var activeRooms = io.sockets.adapter.rooms;
        Chat.aggregate([
            {
                $group: {
                    _id: "$room"
                }
            }
        ], (err, res) => {
            var rooms = []
            for (let room of res) {
                rooms.push(room._id);
            }
            io.to("AdminSocket").emit('rooms', rooms);
        })


    });
});


// catch 404 and forward to error handler
app.use(function (req, res, next) {
    next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.render('error');
});


module.exports = app;
