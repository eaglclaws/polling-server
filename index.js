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

app.use(bodyParser.json());
app.use(morgan('dev'));

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

app.get('/top/:type/:index', (req, res) => {
	var index = parseInt(req.params.index);
	var ret = {posts: [], size: 0};
	db.query(queries.getPosts, [req.params.type, index * 10, req.params.type], (err, rows) => {
		if (err) throw err;
		ret.size = rows[0].total;
		for (var index in rows) {
			var {pid, type, content, time, name, count, likes, comments} = rows[index];
			var inserted = false;
			for (var i in ret.posts) {
				if (ret.posts[i].postId == 'pid_' + pid) {
					ret.posts[i].selection.push({selectionId: 'sid_' + rows[index].sid, text: rows[index].selection});
					inserted = true;
					break;
				}
			}
			if (!inserted) {
				ret.posts.push({postId: 'pid_' + pid, postType: type, timeBefore: time, userCount: count, storyText: content, selection: [{selectionId: 'sid_' + rows[index].sid, text: rows[index].selection}], likes: likes, comments: comments});
			}
			inserted = false;
		}
		res.json(ret);
	});
}); 

app.get('/result/:poll_id', (req, res) => {
	console.log('result/:poll_id');
	console.log(req.params);
	var pollId = req.params.poll_id.split('_')[1];
	db.query(queries.getResult, [pollId, pollId], (err, rows) => {
		if(err) throw err;
		res.setHeader('Content-Type', 'application/json');
		for (var index in rows) {
			rows[index].selectionId = 'sid_' + rows[index].selectionId;
			if (rows[index].percent == null) {
				rows[index].percent = 0.0;
			}
		}
		console.log(rows);
		res.json({selectionResult: rows});
	});
});

app.get('/detail/:poll_id/:result_type', (req, res) => {
	console.log(req.params);
	var pollId = req.params.poll_id.split('_')[1];
	var sql;
	var result = {};
	if (req.params.result_type == 'gender') {
		sql = queries.getByGender;
		db.query(sql, [pollId, pollId], (err, rows) => {
			if (err) throw err;
			for (var index in rows) {
				if (result[rows[index].gender] == null) {
					result[rows[index].gender] = [{selectionId: 'sid_' + rows[index].sid, percent: rows[index].percent == null ? 0.0 : rows[index].percent}];
				} else {
					result[rows[index].gender].push({selectionId: 'sid_' + rows[index].sid, percent: rows[index].percent == null ? 0.0 : rows[index].percent});
				}
			}
			console.log(result);
			res.json(result);
		});
	} else if (req.params.result_type == 'age') {
		db.query(queries.getByAge, [pollId, pollId, pollId], (err, rows) => {
			if (err) throw err;
			console.log(rows);
			for (var index in rows) {
				if (result[rows[index].age.toString()] == null) {
					result[rows[index].age.toString()] = [{selectionId: 'sid_' + rows[index].sid, percent: rows[index].percent == null ? 0.0 : rows[index].percent}];
				} else {
					result[rows[index].age.toString()].push({selectionId: 'sid_' + rows[index].sid, percent: rows[index].percent == null ? 0.0 : rows[index].percent});
				}
			}
			console.log(result);
			res.json(result);
		});
	} else if (req.params.result_type == 'mbti') {
		db.query(queries.getByMbti, [pollId, pollId], (err, rows) => {
			if (err) throw err;
			for (var index in rows) {
				if (result[rows[index].mbti] == null) {
					result[rows[index].mbti] = [{selectionId: 'sid_' + rows[index].sid, percent: rows[index].percent == null ? 0.0 : rows[index].percent}];
				} else {
					result[rows[index].mbti].push({selectionId: 'sid_' + rows[index].sid, percent: rows[index].percent == null ? 0.0 : rows[index].percent});
				}
			}
			res.json(result);
		});
	}
});

app.get('/detail/gender/:poll_id/:is_male', (req, res) => {
	console.log('detail/gender/:poll_id/:is_male');
	console.log(req.params);
	var pid = parseInt(req.params.poll_id.split('_')[1]);
	var gen = req.params.is_male == 'true' ? 'M' : 'F';
	db.query(queries.detailGender, [pid, gen], (err, rows) => {
		for (var index in rows) {
			rows[index].selectionId = 'sid_' + rows[index].selectionId;
		}
		res.json({selectionResult: rows});
	});
});

app.get('/detail/age/:poll_id/:from/:to', (req, res) => {
	var pid = parseInt(req.params.poll_id.split('_')[1]);
	var from = parseInt(req.params.from);
	var to = parseInt(req.params.to);
	db.query(queries.detailAge, [pid, from, to, pid, from, to], (err, rows) => {
		var ret = {};
		for (var index in rows) {
			var per = rows[index].percent == null ? 0.0 : rows[index].percent;
			if (ret[rows[index].age] == null) {
				ret[rows[index].age] = [{selectionId: rows[index].selectionId, percent: per}];
			} else {
				ret[rows[index].age].push({selectionId: rows[index].selectionId, percent: per});
			}
		}
		res.json(ret);
	});
});

app.get('/detail/mbti/:poll_id/:selectE/:selectS/:selectT/:selectJ', (req, res) => {
	var pid = parseInt(req.params.poll_id.split('_')[1]);
	var se = parseInt(req.params.selectE);
	var ss = parseInt(req.params.selectS);
	var st = parseInt(req.params.selectT);
	var sj = parseInt(req.params.selectJ);
	var ei = se == 0 ? '%' : (se == 1 ? 'E' : 'I');
	var sn = ss == 0 ? '%' : (ss == 1 ? 'S' : 'N');
	var tf = st == 0 ? '%' : (st == 1 ? 'T' : 'F');
	var jp = sj == 0 ? '%' : (sj == 1 ? 'J' : 'P');
	var mbti = ei + sn + tf + jp;
	db.query(queries.detailMbti, [pid, mbti, pid, mbti], (err, rows) => {
		var ret = {};
		for (var index in rows) {
			var per = rows[index].percent == null ? 0.0 : rows[index].percent;
			if (ret[rows[index].mbti] == null) {
				ret[rows[index].mbti] = [{selectionId: rows[index].selectionId, percent: per}]
			} else {
				ret[rows[index].mbti].push({selectionId: rows[index].selectionId, perecnt: per});
			}
		}
		res.json(ret);
	});
});

app.post('/postpolling', (req, res) => {
	console.log('postpolling');
	console.log(req.body);
	var {UUID, poll_name, selections, tag} = req.body;
	tag = parseInt(tag.split('_')[1]);
	db.query('INSERT INTO poll (uid, content, type, time) VALUES (?, ?, ?, CURRENT_TIMESTAMP())', [UUID, poll_name, 'polling'], (err, rows) => {
		if (err) throw err;
		db.query('SELECT LAST_INSERT_ID() AS newpid', (err, rows) => {
			var pid = rows[0].newpid;
			async.forEachOf(selections, (selection, index, callback) => {
				db.query('INSERT INTO selection (pid, content) VALUES (?, ?)', [pid, selection], (err, rows) => {
					if (err) callback(err);
					callback(null);
				});
			}, (err) => {
				if (err) throw err;
				db.query('INSERT INTO polltag (pid, tid) VALUES (?, ?)', [pid, tag], (err, rows) => {
					if (err) throw err;
					res.sendStatus(200);
				});
			});
		});
	});
});

app.post('/vote', (req, res) => {
	console.log('vote');
	console.log(req.body);
	var {UUID, poll_id, sid} = req.body;
	poll_id = parseInt(poll_id.split('_')[1]);
	sid = parseInt(sid.split('_')[1]);
	db.query('INSERT INTO polldone (uid, pid, sid) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE sid = ?', [UUID, poll_id, sid, sid], (err, rows) => {
		if (err) throw err;
		res.sendStatus(200);
	});
});

app.post('/postbalance', (req, res) => {
	var {UUID, poll_name, selections, tag} = req.body;
	UUID = parseInt(UUID.split('_')[1]);
	tag = parseInt(tag.split('_')[1]);
	console.log(`SELECT tid FROM tag WHERE name = ${tag}`);
	console.log(`INSERT INTO poll (uid, content, tid, type) VALUES (${UUID}, ${poll_name}, ${tag}, 'balance')`);
	db.query('INSERT INTO poll (uid, content, tid, type) VALUES (?, ?, ? ,?)', [UUID, poll_name, tag, 'balance'], (err, rows) => {
		if (err) throw err;
		db.query('SELECT LAST_INSERT_ID() AS newpid', (err, rows) => {
			var pid = rows[0].newpid;
			async.forEachOf(selections, (selection, index, callback) => {
				db.query('INSERT INTO selection (pid, content) VALUES (?, ?)', [pid, selection], (err, rows) => {
					if (err) callback(err);
					callback(null);
				});
			}, (err) => {
				if (err) throw err;
				res.sendStatus(200);
			});
		});
	});
	for (var index in selections) {
		console.log(`INSERT INTO selection (pid, content) VALUES (pid, ${selections[index]})`);
	}
	res.sendStatus(200);
});

app.post('/signup', (req, res) => {
	console.log('signup');
	console.log(req.body);
	var uid = req.body.UUID;
	var gender = req.body.gender;
	var age = req.body.age;
	var mbti = req.body.mbti;
	if (uid.length != 28) {
		res.sendStatus(400);
	}
	db.query('SELECT name FROM usernames WHERE used = FALSE ORDER BY RAND() LIMIT 1', (err, rows) => {
		if (err) throw err;
		var name = rows[0].name;
		db.query('INSERT INTO user (uid, name, gender, age, mbti) VALUES (?, ?, ?, ?, ?)', [uid, name, gender, age, mbti], (err, rows) => {
			if (err) throw err;
			db.query('UPDATE usernames SET used = TRUE WHERE name = ?', [name], (err, rows) => {
				if (err) throw err;
				res.sendStatus(200);
			});
		});
	});
});

app.get('/nextuuid', (req, res) => {
	db.query(queries.getLastUid, (err, rows) => {
		if (err) throw err;
		res.setHeader('Content-Type', 'application/json');
		res.json({uuid: rows[0].uid + 1});
	});
});

app.post('/rectag', (req, res) => {
	db.query(queries.recTag, (err, rows) => {
		if (err) throw err;
		var tags = [];
		for (var index in rows) {
			tags.push({tagId: 'tid_' + rows[index].tid, tag: rows[index].name});
		}
		res.setHeader('Content-Type', 'application/json');
		res.json({tagList: tags});
	});
});

app.post('/searchtag', (req, res) => {
	console.log('searchtag');
	console.log(req.body);
	var sql;
	if (req.body.tag == "") {
		sql = queries.topTags;
	} else {
		sql = queries.searchTag;
	}
	db.query(sql, [`%${req.body.tag}%`], (err, rows) => {
		if (err) throw err;
		var tags = [];
		for (var index in rows) {
			tags.push({tagId: 'tid_' + rows[index].tid, tag: rows[index].name});
		}
		res.json({tagList: tags});
	});
});

app.get('/testnlp', async (req, res) => {
	var test = '버스 뒷문으로 타는 것 괜찮을까?';
	var list = await python`okt.nouns(${test})`;
	python.ex`
		text = ${list}
		entry = ssem.entrys(text[0])[0]
		sense = entry.senses()[0]
	`;
	var hyper = await python`sense.hyper()`;
	console.log(hyper);
	res.sendStatus(200);
});

app.get('/empty', (req, res) => {
	db.query('SELECT * FROM user WHERE uid = ?', ['6'], (err, rows) => {
		res.json({result: rows});
	});
});

app.listen(port, () => {
	console.log(`Polling server listening on port ${port}`);
});
