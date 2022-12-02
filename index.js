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
const hostUrl = 'http://devcap.duckdns.org:57043/';
const cron = require('node-cron');
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

app.get('/giveadmin/:uid', (req, res) => {
	db.query('UPDATE user SET admin = TRUE WHERE uid = ?', [req.params.uid], (err, rows) => {
		if (err) throw err;
		res.sendStatus(200);
	});
});

app.get('/posts/:index', (req, res) => {
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
			var {uid, image, prefix, name, content, sid, time, link} = rows[index];
			ret.comments.push({profileImage: image, posterUuid: uid, posterId: prefix + ' ' + name, selectNum: sid, content: content, timeBefore: time, link: link == null ? null : 'pid_' + link});
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
	
	db.query('SELECT type FROM poll WHERE pid = ?', [req.params.pid.split('_')[1]], async (err, rows) => {
		var type = rows[0].type;
		const {shortLink, previewLink} = await fdl.createLink({
		dynamicLinkInfo: {
			domainUriPrefix: 'https://pollingcap.page.link',
			link: 'https://devcap.duckdns.org/view?pid=' + req.params.pid + '&type=' + type,
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
		var url = shortLink;
		res.json({link: url, socialTitle: title, socialDescription: desc});
	});
});

app.post('/testfileup', (req, res) => {
	var file = req.files.image;
	var path = './images/selection/'
	var name = file.name.split('.');
	file.mv(path + req.body.selection + '.' + name[name.length - 1]);
	res.sendStatus(200);
});

app.post('/nulltester', (req, res) => {
	res.json({response: req.body.foo == null});
});

app.delete('/deletepost/:pid', (req, res) => {
	var pid = req.params.pid;
	db.query('DELETE FROM battle WHERE pid = ?', [pid], (err, rows) => {
		db.query('DELETE FROM comment WHERE pid = ?', [pid], (err, rows) => {
			
		});
	});
});

app.get('/updatesel', (req, res) => {
	db.query('UPDATE selection SET content = ? WHERE sid = 74', ['반민초파']);
	res.sendStatus(200);
});

app.get('/admin/uids', (req, res) => {
	var ret = {uids: []};
	db.query('SELECT uid FROM user ORDER BY uid', (err, rows) => {
		for (var index in rows) {
			ret.uids.push(rows[index].uid);
		}
		res.json(ret);
	});
});

app.get('/pushtest', (req, res) => {
	var tokens = [];
	db.query('SELECT fcm AS token FROM user WHERE NOT fcm = \'NULL\'', (err, rows) => {
		for (var index in rows) {
			tokens.push(rows[index].token);
		}
		const message = {
			tokens: tokens,
			notification: {
				body: '이미지 첨부된 푸시알림',
				title: '테스트 알림',
			},
			apns: {
				payload: {
					aps: {
						'mutable-content': 1,
					},
				},
				fcm_options: {
					image: hostUrl + 'images/pushtest/image.jpeg',
				},
			},
			android: {
				notification: {
					image: hostUrl + 'images/pushtest/image.jpeg',
				},
			},
			data: {
				postId: 'pid_1',
				postType: 'polling',
			}
		};
		admin
			.messaging()
			.sendMulticast(message)
			.then(response => {
				console.log('Successfully sent message:', response);
				res.sendStatus(200);
			})
			.catch(error => {
				console.log('Error sending message:', error);
			});
	});
});

app.post('/login', (req, res) => {
	var idToken = req.body.token;
	admin.auth()
		.verifyIdToken(idToken)
		.then((decodedToken) => {
			const uid = decodedToken.uid;
			db.query('SELECT * FROM user WHERE uid = ?', [uid], (err, rows) => {
				if (err) throw err;
				console.log('login successful');
				res.json({UUID: uid, isNew: rows.length == 0, isAdmin: rows[0].admin == 1});
			});
		})
		.catch((error) => {
			res.sendStatus(500);
		});
});


cron.schedule('* * * * *', () => {
	console.log('Checking finished battles');
	var tokens = [];
	db.query('SELECT TIMESTAMPDIFF(MINUTE, CURRENT_TIMESTAMP(), end) AS time, pid FROM battle', (err, rows) => {
		for (var index in rows) {
			if (rows[index].time == 0) {
				var pid = rows[index].pid;
				db.query('SELECT fcm as token FROM polldone INNER JOIN user on polldone.uid = user.uid where pid = ? and not fcm = \'NULL\'', [rows[index].pid], (err, rows) => {
					db.query('DELETE FROM battlechat WHERE pid = ?', [pid]);
					for (var index in rows) {
						tokens.push(rows[index].token);
					}
					const message = {
						tokens: tokens,
						notification: {
							body: '사용자님께서 참여하신 배틀 투표가 끝났어요!',
							title: '폴링 - 배틀 투표',
						},
						apns: {
							payload: {
								aps: {
									'mutable-content': 1,
								},
							},
							fcm_options: {
								image: hostUrl + 'images/pushtest/image.jpeg',
							},
						},
						android: {
							notification: {
								image: hostUrl + 'images/pushtest/image.jpeg',
							},
						},
						data: {
							postId: 'pid_' + pid,
							postType: 'battle',
						}
					};
					admin
						.messaging()
						.sendMulticast(message)
						.then(response => {
							console.log('Successfully sent message:', response);
						})
						.catch(error => {
							console.log('Error sending message:', error);
						});
				});
			}
		}
	});
});

app.listen(port, () => {
	console.log(`Polling server listening on port ${port}`);
});
