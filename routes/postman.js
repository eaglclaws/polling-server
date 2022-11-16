const express = require('express');
const router = express.Router();
const postmanRoutes = router.route('/')
const mysql = require('mysql');
const db = mysql.createConnection({
	host: '127.0.0.1',
	port: '54855',
	user: 'develop',
	password: 'cien14789*',
	database: 'pollingtesting'
});
const queries = require('../queries.js');
const bodyParser = require('body-parser');
const usernames = require('../defs/names.json');
const async = require('async');

router.get('/view/:pid', (req, res) => {
	var pid = parseInt(req.params.pid.split('_')[1]);
	db.query(queries.getPostById, [pid], (err, rows) => {
		var ret = {
			postId: 'pid_' + rows[0].pid,
			postType: rows[0].type,
			posterId: rows[0].prefix + ' ' + rows[0].name,
			posterUuid: rows[0].uid,
			timeBefore: rows[0].time,
			userCount: rows[0].count,
			storyText: rows[0].content,
			selection: [],
			likes: rows[0].likes,
			comments: rows[0].comments
		};
		for (var index in rows) {
			ret.selection.push({selectionId: 'sid_' + rows[index].sid, text: rows[index].selection});
		}
		res.json(ret);
	});
});

router.get('/top/:type/:index', (req, res) => {
	var index = parseInt(req.params.index);
	var ret = {posts: [], size: 0};
	if (req.params.type == 'battle') {
		res.json({posts: [{
    postId: 29,
    timeLeft: 52,
    userCount: 252,
    selection: [{text: '부먹'}, {text: '찍먹'}],
},
{
    postId: 30,
    timeLeft: 60,
    userCount: 375,
    selection: [{text: '버스'}, {text: '전철'}],
},
{
    postId: 31,
    timeLeft: 26,
    userCount: 183,
    selection: [{text: '민초파'}, {text: '반민초파'}],
}]});
	}
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
				ret.posts.push({postId: 'pid_' + pid, postType: type, posterImage: rows[index].image, posterUuid: rows[index].uid, posterId: rows[index].prefix + ' ' + rows[index].name, timeBefore: time, userCount: count, storyText: content, selection: [{selectionId: 'sid_' + rows[index].sid, text: rows[index].selection}], likes: likes, comments: comments});
			}
			inserted = false;
		}
		res.json(ret);
	});
}); 

router.get('/result/:poll_id', (req, res) => {
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

router.get('/detail/gender/:poll_id/:is_male', (req, res) => {
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

router.get('/detail/age/:poll_id/:from/:to', (req, res) => {
	var pid = parseInt(req.params.poll_id.split('_')[1]);
	var from = parseInt(req.params.from);
	var to = parseInt(req.params.to);
	db.query(queries.detailAge, [pid, from, to, pid, from, to], (err, rows) => {
		var ret = {};
		var nret = {selectionResult: []}
		var sids = [];
		for (var index in rows) {
			var per = rows[index].percent == null ? 0.0 : rows[index].percent;
			if (ret[rows[index].age] == null) {
				ret[rows[index].age] = [{selectionId: 'sid_' + rows[index].selectionId, percent: per}];
			} else {
				ret[rows[index].age].push({selectionId: 'sid_' + rows[index].selectionId, percent: per});
			}
			if (!sids.includes('sid_' + rows[index].selectionId)) {
				sids.push('sid_' + rows[index].selectionId);
			}
		}
		for (var i in sids) {
			var percent = 0;
			for (var j in ret) {
				for (var k in ret[j]) {
					if (ret[j][k].selectionId == sids[i]) {
						percent += ret[j][k].percent;
					}
				}
			}
			nret.selectionResult.push({selectionId: sids[i], percent: percent});
		}
		res.json(nret);
	});
});

router.get('/detail/mbti/:poll_id/:selectE/:selectS/:selectT/:selectJ', (req, res) => {
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
		var nret = {selectionResult: []};
		var sids = [];
		for (var index in rows) {
			var per = rows[index].percent == null ? 0.0 : rows[index].percent;
			if (ret[rows[index].mbti] == null) {
				ret[rows[index].mbti] = [{selectionId: 'sid_' + rows[index].selectionId, percent: per}]
			} else {
				ret[rows[index].mbti].push({selectionId: 'sid_' + rows[index].selectionId, percent: per});
			}
			if (!sids.includes('sid_' + rows[index].selectionId)) {
				sids.push('sid_' + rows[index].selectionId);
			}
		}
		for (var i in sids) {
			var percentage = 0;
			for (var j in ret) {
				for (var k in ret[j]) {
					if (ret[j][k].selectionId == sids[i]) {
						percentage += ret[j][k].percent;
					}
				}
			}
			nret.selectionResult.push({selectionId: sids[i], percent: percentage});
		}
		res.json(nret);
	});
});

router.post('/vote', (req, res) => {
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

router.post('/postpolling', async (req, res) => {
	console.log('postpolling');
	console.log(req.body);
	var {UUID, poll_name, selections, tag} = req.body;
	tag = parseInt(tag.split('_')[1]);
	var ret = {selections: []};
	db.query('INSERT INTO poll (uid, content, type, time) VALUES (?, ?, ?, CURRENT_TIMESTAMP())', [UUID, poll_name, 'polling'], (err, rows) => {
		if (err) throw err;
		db.query('SELECT LAST_INSERT_ID() AS newpid', (err, rows) => {
			var pid = rows[0].newpid;
			async.forEachOf(selections, (selection, index, callback = () => {
				db.query('SELECT LAST_INSERT_ID() as newsid', (err, rows) => {
					ret.selections.push({selectionId: 'sid_' + rows[0].newsid, text: selection});
				});
			}) => {
				db.query('INSERT INTO selection (pid, content) VALUES (?, ?)', [pid, selection], (err, rows) => {
					if (err) callback(err);
					callback();
				});
			}, (err) => {
				if (err) throw err;
				db.query('INSERT INTO polltag (pid, tid) VALUES (?, ?)', [pid, tag], (err, rows) => {
					if (err) throw err;
					res.json(ret);
				});
			});
		});
	});
});

router.post('/postbalance', (req, res) => {
	console.log('postpolling');
	console.log(req.body);
	var {UUID, poll_name, selections, tag} = req.body;
	tag = parseInt(tag.split('_')[1]);
	db.query('INSERT INTO poll (uid, content, type, time) VALUES (?, ?, ?, CURRENT_TIMESTAMP())', [UUID, poll_name, 'balance'], (err, rows) => {
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
					db.query('SELECT sid, content FROM selection WHERE pid = ?', [pid], (err, rows) => {
						var ret = {selections: []};
						for (var index in rows) {
							ret.selections.push({selectionId: 'sid_' + rows[index].sid, test: rows[index].content});
						}
						res.json(ret);
					});
				});
			});
		});
	});
});


module.exports = router;
