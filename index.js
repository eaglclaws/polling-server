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
const hostUrl = 'http://ec2-3-39-226-193.ap-northeast-2.compute.amazonaws.com:57043/';//'http://devcap.duckdns.org:57043/';
const cron = require('node-cron');
const { CanvasRenderService } = require('chartjs-node-canvas');
const fs = require('fs');
const width = 800;   // define width and height of canvas
const height = 400;
const chartCallback = (ChartJS) => {
 console.log('chart built')
};
const canvasRenderService = new CanvasRenderService(width, height, chartCallback);
app.use(bodyParser.json({limit: '100mb'}));
app.use(morgan('dev'));
app.use('/images', express.static(__dirname + '/images'));
app.use(fileUpload({
	useTempFiles: true,
	tempFileDir: '/home/ubuntu/tmp'
}));

const serviceAccount = require('/home/ubuntu/.firebase/serviceAccountKey.json');

const db = mysql.createConnection({
	host: '127.0.0.1',
	port: '54855',
	user: 'develop',
	password: 'cien14789*',
	database: 'polling'
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
		if (err) {
			console.error(err);
			res.sendStatus(500);
		}
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
		if (err) {
			console.error(err);
			res.sendStatus(500);
		}
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
	db.query('INSERT INTO comment (uid, pid, content) VALUES (?, ?, ?)', [uid, pid, content], (err, rows) => {
		if (err) {
			console.error(err);
			res.sendStatus(500);
		}
		res.sendStatus(200);
	});
});

app.get('/dynamiclink/:pid', async (req, res) => {
	var title = '모두의 의견이 한 곳에! 폴링';
	var desc =  '관심 있을 투표가 이곳에 있어요! 한번 살펴 보시겠어요?';
	
	db.query('SELECT type, content FROM poll WHERE pid = ?', [req.params.pid.split('_')[1]], async (err, rows) => {
		if (err) {
			console.error(err);
			res.sendStatus(500);
		}
		var pollId = req.params.pid.split('_')[1];
		var type = rows[0].type;
		var content = rows[0].content;
		db.query(queries.getResult, [pollId, pollId], async (err, rows) => {
			if(err) throw err;
			for (var index in rows) {
				rows[index].selectionId = 'sid_' + rows[index].selectionId;
				if (rows[index].percent == null) {
					rows[index].percent = 0.0;
				}
			}
			var config = {
				type: 'horizontalBar',
				options: {
					legend: { display: false },
					title: { display: false },
					scales: {
						xAxes: [{
							ticks: {
								min: 0,
								beginAtZero: true
							}
						}],
						x: {
							beginAtZero: true,
							min: 0
						},
						ticks: { min: 0 }
					},
					plugins: {
						legend: {
							labels: {
								font: {
									family: "NanumGothic"
								}
							}
						} 
					}
				},
				data: {
					labels: [],
					datasets: [{
						label: content,
						data: [],
						fill: false,
						backgroundColor: ['red', 'green', 'blue', 'magenta', 'yellow', 'cyan'],
					}]
				}
			};
			for (var i in rows) {
				config.data.labels.push(rows[i].content);
				config.data.datasets[0].data.push(rows[i].percent);
			}
			const dataUrl = await canvasRenderService.renderToDataURL(config);
			var text = dataUrl.toString();
			text = text.split(';base64,').pop();
			fs.writeFile('images/dynamic/pid_' + pollId + '.png', text, {encoding: 'base64'}, () => {});
			var imageUrl = hostUrl + 'images/dynamic/pid_' + pollId + '.png';
			const {shortLink, previewLink} = await fdl.createLink({
				dynamicLinkInfo: {
					domainUriPrefix: 'https://pollingcap.page.link',
					link: 'https://devcap.duckdns.org/view?pid=' + req.params.pid + '&type=' + type + '&imgUrl=' + imageUrl,
					androidInfo: {
						androidPackageName: 'com.polling',
					},
					iosInfo: {
						iosBundleId: 'com.polling',
					},
					socialMetaTagInfo: {
						socialTitle: title,
						socialDescription: content,
						socialImageLink: imageUrl
					},
				},
			});
			var url = shortLink;
			res.json({link: url, socialTitle: title, socialDescription: content, socialImageLink: imageUrl});

		});
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
		if (err) {
			console.error(err);
			res.sendStatus(500);
		}
		for (var index in rows) {
			ret.uids.push(rows[index].uid);
		}
		res.json(ret);
	});
});

app.get('/pushtest', (req, res) => {
	var tokens = [];
	db.query('SELECT fcm AS token FROM user WHERE NOT fcm = \'NULL\'', (err, rows) => {
		if (err) {
			console.error(err);
			res.sendStatus(500);
		}
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
		if (err) {
			console.error(err);
			res.sendStatus(500);
		}
				console.log('login successful');
				res.json({UUID: uid, isNew: rows.length == 0, isAdmin: !rows[0] ? false : rows[0].admin == 1});
			});
		})
		.catch((error) => {
			res.sendStatus(500);
		});
});


cron.schedule('* * * * *', () => {
	if (process.env.NODE_APP_INSTANCE === '0') {
	console.log('Checking finished battles');
	db.query('SELECT TIMESTAMPDIFF(MINUTE, CURRENT_TIMESTAMP(), end) AS time, pid, prefix, image FROM battle', (err, rows) => {
		if (err) {
			console.error(err);
			res.sendStatus(500);
		}
		for (var index in rows) {
			if (rows[index].time == 0) {
				var tokens = [];
				var pid = rows[index].pid;
				var prefix = rows[index].prefix;
				var image = rows[index].image;
				db.query('SELECT fcm as token, user.uid, sid FROM polldone INNER JOIN user on polldone.uid = user.uid where pid = ? and not fcm = \'NULL\'', [rows[index].pid], (err, rows) => {
					if (err) {
						console.error(err);
						res.sendStatus(500);
					}
					var users = rows;
					db.query(queries.battleResult, [pid], (err, rows) => {
						var percent = !rows[0] ? 0 : rows[0].percent;
						var sid = !rows[0] ? '' : rows[0].sid;
						users.forEach((user) => {
							if ((percent >= 50 && user.sid == sid) || (percent < 50 && user.sid != sid)) {
								db.query('INSERT INTO userprofile (uid, profile_url) VALUES (?, ?)', [user.uid, image], (err, rows) => {
								if (err) {
									console.error(err);
									res.sendStatus(500);
									}
								});
							}
							db.query('INSERT INTO userprefix (uid, prefix) VALUES (?, ?)', [user.uid, prefix], (err, rows) => {
								if (err) {
									console.error(err);
									res.sendStatus(500);
								}
							});
						});
					});
					db.query('DELETE FROM battlechat WHERE pid = ?', [pid]);
					db.query('UPDATE battle SET end = TIMESTAMPADD(MINUTE, -2, end) WHERE pid = ?', [pid]);
					for (var index in rows) {
						tokens.push(rows[index].token);
					}
					console.log(tokens);
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
							},
						},
						android: {
							notification: {
							},
						},
						data: {
							postId: 'pid_' + pid,
							postType: 'battle',
						}
					};
					if (tokens.length != 0) {
						admin
							.messaging()
							.sendMulticast(message)
							.then(response => {
								console.log('Successfully sent message:', response);
							})
							.catch(error => {
								console.log('Error sending message:', error);
							});
					}
				});
			}
		}
	});
	console.log("update recommendation ratings");
	rec_update();
	console.log('update corelations');
	corel_update();}
});

var rec_update = async (req, res) => {
	db.query('SELECT uid FROM user', async (err, rows) => {
		var users = rows;
		db.query('SELECT tid FROM tag', async (err, rows) => {
			var tags = rows;
			users.forEach(async (user) => {
				tags.forEach(async (tag) => {
					await db.query('INSERT IGNORE INTO recommendation_rating (uid, tid, rating) VALUES (?, ?, 0)', [user.uid, tag.tid]);
				});
				db.query('SELECT uid, tid, COUNT(tid) AS rating FROM polldone INNER JOIN polltag ON polldone.pid = polltag.pid WHERE uid = ? GROUP BY tid', [user.uid], async (err, rows) => {
					if (rows) {
						rows.forEach((row) => {
							db.query('UPDATE recommendation_rating SET rating = ? WHERE tid = ? AND uid = ?', [row.rating, row.tid, row.uid]);
						});
					}
				});
			});
		});
	});
}

var corel_update = async (req, res) => {
	var vecs = {};
	var tag_count = 0;
	var vec_avgs = {};
	var vec_sigmas = {};
	var users = [];
	var ratings;
	var getUser = new Promise((resolve, reject) => {
		db.query('SELECT uid FROM user', (err, rows) => {
			if (err) reject(err);
			rows.forEach((row) => {
				vecs[row.uid] = {};
				users.push(row.uid);
			});
			return resolve(rows)
		});
	});
	var getVector = new Promise((resolve, reject) => {
		 db.query('SELECT uid, tid, rating FROM recommendation_rating', (err, rows) => {
			if (err) reject(err);
			if (rows) {
				var count = 0;
				rows.forEach((row) => {
					vecs[row.uid][row.tid] = row.rating;
				});
			}
			return resolve(vecs);
		 });
	});
	await getUser;
	await getVector;
	for (var i in vecs[users[0]]) {
		tag_count++;
	}
	users.forEach((user) => {
		vec_avgs[user] = 0;
		vec_sigmas[user] = 0;
		for (var i in vecs[user]) {
			vec_avgs[user] += vecs[user][i];
		}
		vec_avgs[user] /= tag_count;
		for (var i in vecs[user]) {
			vec_sigmas[user] += (vecs[user][i] - vec_avgs[user]) * (vecs[user][i] - vec_avgs[user]);
		}
		vec_sigmas[user] = Math.sqrt(vec_sigmas[user] / tag_count);
	});
	users.forEach((userA) => {
		users.forEach((userB) => {
			if (!(userA == userB)) {
				var Cab = covar(vecs[userA], vec_avgs[userA], vecs[userB], vec_avgs[userB]) / (vec_sigmas[userA] * vec_sigmas[userB]);
				Cab = isNaN(parseFloat(Cab)) ? 0 : Cab;
				db.query('INSERT INTO rec_corelation (src_uid, des_uid, corelation) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE corelation = ?', [userA, userB, Cab, Cab]);
			}
		});
	});
	/*
	await db.query('SELECT uid FROM user', async (err, rows) => {
		await rows.forEach(async (user) => {
			users.push(user.uid);
			user_vec_avg[user.uid] = 0;
			user_vecs[user.uid] = {};
			await db.query('SELECT tid, rating WHERE uid = ?', [user.uid], async (err, rows) => {
				if (rows) {
					await rows.forEach((row) => {
						user_vecs[user.uid][row.tid] = row.rating;
					});
					var count = 0;
					for (var x in user_vecs[user.uid]) {
						user_vec_avg[user.uid] += user_vecs[user.uid][x];
						count++;
					}
					user_vec_avg[user.uid] /= count;
					for (var x in user_vecs[user.uid]) {
						user_vec_sigma[user.uid] += (user_vecs[user.uid][x] - user_vec_avg[user.uid]) * (user_vecs[user.uid][x] - user_vec_avg[user.uid]);
					}
					user_vec_sigma[user.uid] = Math.sqrt(user_vec_sigma[user.uid] / count);
				}
			});
		});
	});
	await users.forEach(async (userA) => {
		await users.forEach((userB) => {
			if (!(userA == userB)) {
				var Cab = covar(user_vecs[userA], user_vec_avg[userA], user_vecs[userB], user_vec_avg[userB]) / (user_vec_sigma[userA] * user_vec_sigma[userB]);
				console.log(Cab);
				db.query('INSERT INTO rec_corelation (src_uid, des_uid, corelation) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE corelation = ?', [userA, userB, Cab, Cab]);
			}
		});
	});
	*/
}

function sigma(vector, avg) {
	var ret = 0;
	var count = 0;
	for (var i in vector) {
		ret += (vector[i] - avg) * (vector[i] - avg);
		count++;
	}
	ret /= count;
	ret = Math.sqrt(ret);
	return ret;
}

function covar(vectorA, avgA, vectorB, avgB) {
	var ret = 0;
	var count = 0;
	for (var i in vectorA) {
		ret += (vectorA[i] - avgA) * (vectorB[i] - avgB);
		count++;
	}
	ret /= count;
	return ret;
}

app.listen(port, () => {
	console.log(`Polling server listening on port ${port}`);
});
