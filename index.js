'use strict';

const express = require('express');
const app = express();
const mysql = require('mysql');
const admin = require('firebase-admin');
const port = 57043;
const async = require('async');
const queries = require('./queries.js');
const bodyParser = require('body-parser');
const assert = require('assert');
const pythonBridge = require('python-bridge');
const python = pythonBridge({python: 'python3'});
const stopwords = require('stopwords-ko');
const usernames = require('./defs/names.json');
const morgan = require('morgan');
const router = express.Router();
const api = router.route('/');
const FDL = require('firebase-dynamic-links');
const fdl = new FDL.FirebaseDynamicLinks('AIzaSyD4OXIGO-t86tsvYqMqVX3C2axRiS6inrE');
const fileUpload = require('express-fileupload');

app.use(bodyParser.json({limit: '100mb'}));
app.use(morgan('dev'));
app.use('/images', express.static(__dirname + '/images'));
app.use(fileUpload({
	useTempFiles: true,
	tempFileDir: '/home/seokhyeon/tmp'
}));

const serviceAccount = require('/home/seokhyeon/.firebase/serviceAccountKey.json');

const db = mysql.createConnection({
	host: '127.0.0.1',
	port: '54855',
	user: 'develop',
	password: 'cien14789*',
	database: 'pollingtesting'
});

admin.initializeApp({
	credential: admin.credential.cert(serviceAccount)
});

python.ex`from nltk.sejong import ssem`
python.ex`import konlpy`
python.ex`okt = konlpy.tag.Okt()`

const usermanRoutes = require('./routes/userman');
const postmanRoutes = require('./routes/postman');
const tagmanRoutes = require('./routes/tagman');
app.use(usermanRoutes);
app.use(postmanRoutes);
app.use(tagmanRoutes);

app.get('/', (req, res) => {
	res.send('Hello World!<br><a href="/posts">Test Database!</a>');
});

app.post('/login', (req, res) => {
	console.log('login');
	console.log(req.body);
	var idToken = req.body.token;
	admin.auth()
		.verifyIdToken(idToken)
		.then((decodedToken) => {
			const uid = decodedToken.uid;
			db.query('SELECT * FROM user WHERE uid = ?', [uid], (err, rows) => {
				if (err) throw err;
				console.log('login successful');
				res.json({UUID: uid, isNew: rows.length == 0});
			});
		})
		.catch((error) => {
			res.sendStatus(500);
		});
});

app.get('/db', (req, res) => {
	var sql = `SHOW TABLES`;
	db.query(sql, (err, data, fields) => {
		if (err) throw err;
		res.json({
			status: 200,
			data,
			message: "Success"
		});
	});
});

app.get('/posts/:index', (req, res) => {
	console.log('posts/:index');
	console.log(req.params);
	var tasks = [
		function (callback) {
			db.query(queries.countAllPosts, (err, row) => {
				if (err) return callback(err);
				callback(null, row[0].sum);
			});
		},
		function (sum, callback) {
			db.query(queries.topTenPosts, [parseInt(req.params.index) * 10], (err, data, fields) => {
				if (err) return callback(err);
				const posts = data.reduce((prev, next) => {
					if(!Array.isArray(prev)) {
						prev = [prev];
					}
					for (var index in prev) {
						if (prev[index].postId == next.postId || prev[index].postId == 'pid_' + next.postId) {
							if(prev[index].selection == null) {
								prev[index].postId = 'pid_' + prev[index].postId;
								prev[index].selection = [{selectionId: 'sid_' + prev[index].selectionId, text: prev[index].selectionText}, {selectionId: 'sid_' + next.selectionId, text: next.selectionText}];
								delete prev[index].selectionId;
								delete prev[index].selectionText;
							} else {
								prev[index].selection.push({selectionId: 'sid_' + next.selectionId, text: next.selectionText});
							}
							return prev;
						}
					}
					prev.push(next);
					return prev;
				});
				var data = {posts: posts, size: sum};
				callback(null, data);
			});
		},
		function(data, callback) {
			res.setHeader('Content-Type', 'application/json');
			res.json(data);
		}
	];
	async.waterfall(tasks, function(err) {
		if (err) throw err;
	});
});


app.get('/nextuuid', (req, res) => {
	db.query(queries.getLastUid, (err, rows) => {
		if (err) throw err;
		res.setHeader('Content-Type', 'application/json');
		res.json({uuid: rows[0].uid + 1});
	});
});


app.get('/empty', (req, res) => {
	db.query('SELECT * FROM user WHERE uid = ?', ['6'], (err, rows) => {
		res.json({result: rows});
	});
});

app.get('/comments/:pid', (req, res) => {
	var pid = parseInt(req.params.pid.split('_')[1]);
	db.query(queries.getComments, [pid, pid], (err, rows) => {
		var ret = {comments: []};
		for (var index in rows) {
			var {uid, image, prefix, name, content, sid, time} = rows[index];
			ret.comments.push({profileImage: image, posterUuid: uid, posterId: prefix + ' ' + name, selectNum: sid, content: content, timeBefore: time});
		}
		res.json(ret);
	});
});

app.post('/postcomment', (req, res) => {
	var uid = req.body.UUID;
	var pid = parseInt(req.body.pid.split('_')[1]);
	var content = req.body.content;
	db.query('INSERT INTO comment (uid, pid, content) VALUES (?, ?, ?)', [uid, pid, content], () => {
		res.sendStatus(200);
	});
});

app.get('/dynamiclink/:pid', async (req, res) => {
	var title = '모두의 의견이 한 곳에! 폴링';
	var desc =  '관심 있을 투표가 이곳에 있어요! 한번 살펴 보시겠어요?';
	const {shortLink, previewLink} = await fdl.createLink({
		dynamicLinkInfo: {
			domainUriPrefix: 'https://pollingcap.page.link',
			link: 'https://devcap.duckdns.org/view/' + req.params.pid,
			androidInfo: {
				androidPackageName: 'com.polling',
			},
			iosInfo: {
				iosBundleId: 'com.polling',
			},
			socialMetaTagInfo: {
				socialTitle: title,
				socialDescription: desc,
			},
		},
	});
	db.query('SELECT type FROM poll WHERE pid = ?', [req.params.pid.split('_')[1]], (err, rows) => {
		var type = rows[0].type;
		var url = shortLink;
		res.json({link: url, socialTitle: title, socialDescription: desc});
	});
});

app.post('/testfileup', (req, res) => {
	console.log(req.body.selection);
	var file = req.files.image;
	var path = './images/selection/'
	var name = file.name.split('.');
	file.mv(path + req.body.selection + '.' + name[name.length - 1]);
	res.sendStatus(200);
});

app.listen(port, () => {
	console.log(`Polling server listening on port ${port}`);
});
