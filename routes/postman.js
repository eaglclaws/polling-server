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
const fs = require('fs');
const hostUrl = 'ec2-3-39-226-193.ap-northeast-2.compute.amazonaws.com:57043/';

router.get('/view/:pid', (req, res) => {
	var pid = parseInt(req.params.pid.split('_')[1]);
	db.query(queries.getPostById, [pid], (err, rows) => {
		if (err) throw err;
		var ret = {
			postId: 'pid_' + rows[0].pid,
			postType: rows[0].type,
			posterId: rows[0].prefix + ' ' + rows[0].name,
			posterUuid: rows[0].uid,
			posterImage: rows[0].image,
			timeBefore: rows[0].time,
			userCount: rows[0].count,
			storyText: rows[0].content,
			selection: [],
			likes: rows[0].likes,
			comments: rows[0].comments
		};
		for (var index in rows) {
			ret.selection.push({selectionId: 'sid_' + rows[index].sid, text: rows[index].selection, image: rows[index].simage});
		}
		res.json(ret);
	});
});

router.get('/view/battle/:pid', (req, res) => {
	var pid = req.params.pid.split('_')[1];
	db.query(queries.getBattleById, [pid], (err, rows) => {
		if (err) throw err;
		var ret = {
			postId: 'pid_' + rows[0].pid,
			postType: rows[0].type,
			posterId: rows[0].prefix + ' ' + rows[0].name,
			posterUuid: rows[0].uid,
			posterImage: rows[0].image,
			timeBefore: rows[0].time,
			userCount: rows[0].count,
			storyText: rows[0].content,
			selection: [],
			likes: rows[0].likes,
			comments: rows[0].comments,
			timeLeft: rows[0].timeLeft > 0 ? rows[0].timeLeft : 0,
			textA: {text: rows[0].selection, selectionId: 'sid_' + rows[0].sid},
			textB: {text: rows[1].selection, selectionId: 'sid_' + rows[1].sid}
		};
		for (var index in rows) {
			ret.selection.push({selectionId: 'sid_' + rows[index].sid, text: rows[index].selection, image: rows[index].simage});
		}
		res.json(ret);
	});
});

router.get('/top/:type/:index', (req, res) => {
	var index = parseInt(req.params.index);
	var ret = {posts: [], size: 0};
	if (req.params.type == 'battle') {
		db.query(queries.battlePosts, [parseInt(req.params.index) * 10], (err, rows) => {
			if (rows[0] == undefined) {
				res.statusMessage = "[POLLING SEVER ERROR] Page request out of bounds";
				res.status(400).send(res.statusMessage);
				return;
			}
			for (var index = 0; index < rows.length; index += 2) {
				ret.posts.push({
					postId: 'pid_' + rows[index].pid,
					timeLeft: rows[index].time > 0 ? rows[index].time : 0,
					userCount: rows[index].count,
					textA: {
						selectionId: 'sid_' + rows[index].sid,
						text: rows[index].selection,
						image: rows[index].simage
					},
					textB: {
						selectionId: 'sid_' + rows[index + 1].sid,
						text: rows[index + 1].selection,
						image: rows[index + 1].simage
					},
					prefix: rows[index].bprefix,
					profileImg: rows[index].bimage
				});
			}
			db.query('SELECT COUNT(*) AS size FROM poll WHERE type = \'battle\'', (err, rows) => {
				ret.size = rows[0].size;
				res.json(ret);
			});
			return;
		});
	} else {
		//TODO: Update query to getRecommend, params as [type, uid, corelation, uid, type, index, type]
	db.query(queries.getPosts, [req.params.type, index * 10, req.params.type], (err, rows) => {
		if (err) throw err;
		if (rows[0] == undefined) {
			res.statusMessage = "[POLLING SEVER ERROR] Page request out of bounds";
			res.status(400).send(res.statusMessage);
			return;
		}
		ret.size = rows[0].total;
		for (var index in rows) {
			var {pid, type, content, time, name, count, likes, comments} = rows[index];
			var inserted = false;
			for (var i in ret.posts) {
				if (ret.posts[i].postId == 'pid_' + pid) {
					ret.posts[i].selection.push({selectionId: 'sid_' + rows[index].sid, text: rows[index].selection, image: rows[index].simage});
					inserted = true;
					break;
				}
			}
			if (!inserted) {
				ret.posts.push({postId: 'pid_' + pid, postType: type, posterImage: rows[index].image, posterUuid: rows[index].uid, posterId: rows[index].prefix + ' ' + rows[index].name, timeBefore: time, userCount: count, storyText: content, selection: [{selectionId: 'sid_' + rows[index].sid, text: rows[index].selection, image: rows[index].simage}], likes: likes, comments: comments});
			}
			inserted = false;
		}
		res.json(ret);
	});
	}
});

router.get('/getselection/:uid/:pid', (req, res) => {
	db.query('SELECT sid FROM polldone WHERE uid = ? AND pid = ?', [req.params.uid, req.params.pid.split('_')[1]], (err, rows) => {
		res.json({selection: rows[0] == undefined ? null : 'sid_' + rows[0].sid});
	});
});

router.post('/search', (req, res) => {
	var ret = {posts: [], size: 0};
	db.query(queries.searchPosts, [`%${req.body.searchWord}%`, req.body.page_index * 10, `%${req.body.searchWord}%`], (err, rows) => {
		if (err) throw err;
		if (rows[0] == undefined) {
			res.statusMessage = "[POLLING SEVER ERROR] Page request out of bounds";
			res.status(400).send(res.statusMessage);
			return;
		}
		ret.size = rows[0].total;
		for (var index in rows) {
			var {pid, type, content, time, name, count, likes, comments} = rows[index];
			var inserted = false;
			for (var i in ret.posts) {
				if (ret.posts[i].postId == 'pid_' + pid) {
					ret.posts[i].selection.push({selectionId: 'sid_' + rows[index].sid, text: rows[index].selection, image: rows[index].simage});
					inserted = true;
					break;
				}
			}
			if (!inserted) {
				ret.posts.push({postId: 'pid_' + pid, postType: type, posterImage: rows[index].image, posterUuid: rows[index].uid, posterId: rows[index].prefix + ' ' + rows[index].name, timeBefore: time, userCount: count, storyText: content, selection: [{selectionId: 'sid_' + rows[index].sid, text: rows[index].selection, image: rows[index].simage}], likes: likes, comments: comments});
			}
			inserted = false;
		}
		res.json(ret);
	});
});

router.get('/madeby/:uid/:type/:index', (req, res) => {
	var ret = {posts: [], size: 0};
	db.query(queries.madePosts, [req.params.uid, req.params.type, req.params.index * 10, req.params.uid, req.params.type], (err, rows) => {
		if (err) throw err;
		if (rows[0] == undefined) {
			res.statusMessage = "[POLLING SEVER ERROR] Page request out of bounds";
			res.status(400).send(res.statusMessage);
			return;
		}
		ret.size = rows[0].total;
		for (var index in rows) {
			var {pid, type, content, time, name, count, likes, comments} = rows[index];
			var inserted = false;
			for (var i in ret.posts) {
				if (ret.posts[i].postId == 'pid_' + pid) {
					ret.posts[i].selection.push({selectionId: 'sid_' + rows[index].sid, text: rows[index].selection, image: rows[index].simage});
					inserted = true;
					break;
				}
			}
			if (!inserted) {
				ret.posts.push({postId: 'pid_' + pid, postType: type, posterImage: rows[index].image, posterUuid: rows[index].uid, posterId: rows[index].prefix + ' ' + rows[index].name, timeBefore: time, userCount: count, storyText: content, selection: [{selectionId: 'sid_' + rows[index].sid, text: rows[index].selection, image: rows[index].simage}], likes: likes, comments: comments});
			}
			inserted = false;
		}
		res.json(ret);
	});
});

router.get('/doneby/:uid/:type/:index', (req, res) => {
	var ret = {posts: [], size: 0};
	db.query(queries.donePosts, [req.params.uid, req.params.type, req.params.index * 10, req.params.uid, req.params.type], (err, rows) => {
		if (err) throw err;
		if (rows[0] == undefined) {
			res.statusMessage = "[POLLING SEVER ERROR] Page request out of bounds";
			res.status(400).send(res.statusMessage);
			return;
		}
		ret.size = rows[0].total;
		for (var index in rows) {
			var {pid, type, content, time, name, count, likes, comments} = rows[index];
			var inserted = false;
			for (var i in ret.posts) {
				if (ret.posts[i].postId == 'pid_' + pid) {
					ret.posts[i].selection.push({selectionId: 'sid_' + rows[index].sid, text: rows[index].selection, image: rows[index].simage});
					inserted = true;
					break;
				}
			}
			if (!inserted) {
				ret.posts.push({postId: 'pid_' + pid, postType: type, posterImage: rows[index].image, posterUuid: rows[index].uid, posterId: rows[index].prefix + ' ' + rows[index].name, timeBefore: time, userCount: count, storyText: content, selection: [{selectionId: 'sid_' + rows[index].sid, text: rows[index].selection, image: rows[index].simage}], likes: likes, comments: comments});
			}
			inserted = false;
		}
		res.json(ret);
	});
});

router.get('/battleresult/:pid', (req, res) => {
	console.log(req.params.pid);
	db.query(queries.battleResult, [req.params.pid.split('_')[1]], (err, rows) => {
		var pid = req.params.pid.split('_')[1];
		var row = rows;
		db.query(queries.battleCountTime, [pid, pid], (err, rows) => {
			if (row == undefined) {
				res.json({percentA: 0});
				return;
			} else {
				var percent = row[0].percent;
				res.json({percentA: percent, userCount: rows[0].userCount, timeLeft: rows[0].time});
			}
		});
	});
});

router.get('/battle/reward/:pid', (req, res) => {
	db.query('SELECT prefix, image FROM battle WHERE pid = ?', [req.params.pid.split('_')[1]], (err, rows) => {
		var ret = {profileImg: rows[0].image, prefix: rows[0].prefix};
		db.query(queries.battleResult, [req.params.pid.split('_')[1]], (err, rows) => {
			if (rows[0] == undefined) {
				ret.percentA = 0;
			} else { 
				ret.percentA = rows[0].percent;
			}
			res.json(ret);
		});
	});
});

router.post('/upload/linkpoll', (req, res) => {
	var {UUID, poll_name, selections, tag, postId} = req.body;
	var ret = {selections: []};
	db.query('INSERT INTO poll (uid, content, type, time) VALUES (?, ?, ?, CURRENT_TIMESTAMP())', [UUID, poll_name, 'link'], (err, rows) => {
		if (err) throw err;
		db.query('SELECT LAST_INSERT_ID() AS newpid', (err, rows) => {
			var pid = rows[0].newpid;
			async.forEachOf(selections, (selection, index, callback) => {
				var label = selection.label;
				db.query('INSERT INTO selection (pid, content, image) VALUES (?, ?, NULL)', [pid, label], (err, rows) => {
					if (err) callback(err);
					callback(null);
				});
			}, (err) => {
				if (err) throw err;
				db.query('INSERT INTO comment (pid, uid, link, content) VALUES (?, ?, ?, \'\')', [postId.split('_')[1], UUID, pid], (err, rows) => {
					if (err) throw err;
					res.sendStatus(200);
				});
			});
		});
	});
});

router.get('/result/:poll_id', (req, res) => {
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
		res.json({selectionResult: rows});
	});
});

router.get('/detail/gender/:poll_id/:is_male', (req, res) => {
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
	var {UUID, poll_id, sid} = req.body;
	poll_id = parseInt(poll_id.split('_')[1]);
	sid = parseInt(sid.split('_')[1]);
	db.query('INSERT INTO polldone (uid, pid, sid) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE sid = ?', [UUID, poll_id, sid, sid], (err, rows) => {
		if (err) throw err;
		res.sendStatus(200);
	});
});

router.post('/postpolling', async (req, res) => {
	var {UUID, poll_name, selections, tag} = req.body;
	tag = parseInt(tag.split('_')[1]);
	var ret = {selections: []};
	db.query('INSERT INTO poll (uid, content, type, time) VALUES (?, ?, ?, CURRENT_TIMESTAMP())', [UUID, poll_name, 'polling'], (err, rows) => {
		if (err) throw err;
		db.query('SELECT LAST_INSERT_ID() AS newpid', (err, rows) => {
			var pid = rows[0].newpid;
			async.forEachOf(selections, (selection, index, callback) => {
				var label = selection.label;
				var image = selection.image;
				db.query('INSERT INTO selection (pid, content, image) VALUES (?, ?, ?)', [pid, label, image], (err, rows) => {
					if (err) callback(err);
					callback(null);
				});
			}, (err) => {
				if (err) throw err;
				db.query('INSERT INTO polltag (pid, tid) VALUES (?, ?)', [pid, tag], (err, rows) => {
					if (err) throw err;
					db.query('SELECT sid, image FROM selection WHERE pid = ?', [pid], (err, rows) => {
						async.forEachOf(rows, (row, index, callback) => {
							if (row.image != '') {
								var ext = (row.image.split(';base64,')[0]).split('/').pop();
								var b64 = row.image.split(';base64,').pop();
								fs.writeFile('images/selection/sid_' + row.sid + '.' + ext, b64, {encoding: 'base64'}, (err) => {});
								var url = hostUrl + 'images/selection/sid_' + row.sid + '.' + ext;
								db.query('UPDATE selection SET image = ? WHERE pid = ? AND sid = ?', [url, pid, row.sid], (err, rows) => {
									if (err) throw err;
									callback(null);
								});
							} else {
								db.query('UPDATE selection SET image = NULL WHERE sid = ?', [row.sid], (err, rows) => {
									callback(null);
								});
							}
						}, (err) => {
							res.sendStatus(200);
						});
					});
				});
			});
		});
	});
});

router.post('/postbalance', (req, res) => {
	var {UUID, poll_name, selections, tag} = req.body;
	tag = parseInt(tag.split('_')[1]);
	db.query('INSERT INTO poll (uid, content, type, time) VALUES (?, ?, ?, CURRENT_TIMESTAMP())', [UUID, poll_name, 'balance'], (err, rows) => {
		if (err) throw err;
		db.query('SELECT LAST_INSERT_ID() AS newpid', (err, rows) => {
			var pid = rows[0].newpid;
			async.forEachOf(selections, (selection, index, callback) => {
				var label = selection.label;
				var image = selection.image;
				db.query('INSERT INTO selection (pid, content, image) VALUES (?, ?, ?)', [pid, label, image], (err, rows) => {
					if (err) callback(err);
					callback(null);
				});
			}, (err) => {
				if (err) throw err;
				db.query('INSERT INTO polltag (pid, tid) VALUES (?, ?)', [pid, tag], (err, rows) => {
					if (err) throw err;
					db.query('SELECT sid, image FROM selection WHERE pid = ?', [pid], (err, rows) => {
						async.forEachOf(rows, (row, index, callback) => {
							if (row.image != '') {
								var ext = row.image.split(';base64,')[0].split('/').pop();
								var b64 = row.image.split(';base64,').pop();
								fs.writeFile('images/selection/sid_' + row.sid + '.' + ext, b64, {encoding: 'base64'}, (err) => {});
								var url = hostUrl + 'images/selection/sid_' + row.sid + '.' + ext;
								db.query('UPDATE selection SET image = ? WHERE sid = ?', [url, row.sid], (err, rows) => {
									if (err) throw err;
									callback(null);
								});
							} else {
								db.query('UPDATE selection SET image = NULL WHERE sid = ?', [row.sid], (err, rows) => {
									callback(null);
								});
							}
						}, (err) => {
							res.sendStatus(200);
						});
					});
				});
			});
		});
	});
});

router.post('/postbattle', (req, res) => {
	var {UUID, poll_name, selections} = req.body;
	db.query('INSERT INTO poll (uid, content, type, time) VALUES (?, ?, ?, CURRENT_TIMESTAMP())', [UUID, poll_name, 'battle'], (err, rows) => {
		if (err) throw err;
		db.query('SELECT LAST_INSERT_ID() AS newpid', (err, rows) => {
			var pid = rows[0].newpid;
			async.forEachOf(selections, (selection, index, callback) => {
				var label = selection.label;
				var image = selection.image;
				db.query('INSERT INTO selection (pid, content, image) VALUES (?, ?, ?)', [pid, label, image], (err, rows) => {
					if (err) callback(err);
					callback(null);
				});
			}, (err) => {
				if (err) throw err;
					if (err) throw err;
					db.query('SELECT sid, image FROM selection WHERE pid = ?', [pid], (err, rows) => {
						async.forEachOf(rows, (row, index, callback) => {
							if (row.image != '') {
								var ext = row.image.split(';base64,')[0].split('/').pop();
								var b64 = row.image.split(';base64,').pop();
								fs.writeFile('images/selection/sid_' + row.sid + '.' + ext, b64, {encoding: 'base64'}, (err) => {});
								var url = hostUrl + 'images/selection/sid_' + row.sid + '.' + ext;
								db.query('UPDATE selection SET image = ? WHERE sid = ?', [url, row.sid], (err, rows) => {
									if (err) throw err;
									callback(null);
								});
							} else {
								db.query('UPDATE selection SET image = NULL WHERE sid = ?', [row.sid], (err, rows) => {
									callback(null);
								});
							}
						}, (err) => {
							var ext = req.body.profileImg.split(';base64,')[0].split('/').pop();
							var b64 = req.body.profileImg.split(';base64,').pop();
							var fcount = fs.readdirSync('images/profile').length
							fs.writeFile('images/profile/profile' + fcount + '.' + ext, b64, {encoding: 'base64'}, (err) => {});
							var url = hostUrl + 'images/profile' + fcount + '.' + ext;
							db.query('INSERT INTO battle (pid, end, prefix, image) VALUES (?, TIMESTAMPADD(MINUTE, ?, CURRENT_TIMESTAMP()), ?, ?)', [pid, parseInt(req.body.endMinute), req.body.prefix, url], (err, rows) => {
								if (err) throw err;				
								res.sendStatus(200);
							});
						});
					});
			});
		});
	});
});

router.get('/battlechat/:pid', (req, res) => {
	db.query(queries.battleChats, [req.params.pid.split('_')[1]], (err, rows) => {
		var ret = {chats: []};
		var one = null;
		var two = null;
		for (var index in rows) {
			var pfp = rows[index].image;
			var name = rows[index].prefix + ' ' + rows[index].name;
			var select = rows[index].sid;
			var time = rows[index].time;
			ret.chats.push({
				profileImage: pfp,
				posterId: name,
				selectNum: select,
				content: rows[index].content,
				time: time
			});
		}
		db.query('SELECT sid FROM selection WHERE pid = ? ORDER BY sid', [req.params.pid.split('_')[1]], (err, rows) => {
			one = rows[0].sid;
			two = rows[1].sid;
			for (var index in ret.chats) {
				ret.chats[index].selectNum = ret.chats[index].selectNum == one ? 1 : 2;
			}
			res.json(ret);
		});
	});
});

router.post('/upload/chat', (req, res) => {
	var uid = req.body.UUID;
	var pid = req.body.postId.split('_')[1];
	var content = req.body.content;
	db.query('INSERT INTO battlechat (uid, pid, content) VALUES (?, ?, ?)', [uid, pid, content], (err, rows) => {
		res.sendStatus(200);
	});
});

router.get('/testnull', (req, res) => {
	db.query('SELECT image FROM selection WHERE pid = 37', (err, rows) => {
		for (var index in rows) {
		}
		res.sendStatus(200);
	});
});

module.exports = router;
