const express = require('express');
const app = express();
const mysql = require('mysql');
const port = 57043;
const async = require('async');
const queries = require('./queries.js');
const bodyParser = require('body-parser');
const assert = require('assert');
const pythonBridge = require('python-bridge');
const python = pythonBridge({python: 'python3'});
const stopwords = require('stopwords-ko');

app.use(bodyParser.json());

db = mysql.createConnection({
	host: '127.0.0.1',
	port: '54855',
	user: 'develop',
	password: 'cien14789*',
	database: 'pollingtesting'
});

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

app.get('/result/:poll_id', (req, res) => {
	var pollId = req.params.poll_id.split('_')[1];
	db.query(queries.getResult, [pollId], (err, rows) => {
		if(err) throw err;
		res.setHeader('Content-Type', 'application/json');
		res.json({selectionResult: rows});
	});
});

app.post('/postpolling', (req, res) => {
	var {UUID, poll_name, selections, tag} = req.body;
	console.log(`SELECT tid FROM tag WHERE name = ${tag}`);
	console.log(`INSERT INTO poll (uid, content, tid, type) VALUES (${UUID}, ${poll_name}, ${tag}, 'polling')`);
	for (var index in selections) {
		console.log(`INSERT INTO selection (pid, content) VALUES (pid, ${selections[index]})`);
	}
	res.sendStatus(200);
});

app.post('/postbalance', (req, res) => {
	var {UUID, poll_name, selections, tag} = req.body;
	console.log(`SELECT tid FROM tag WHERE name = ${tag}`);
	console.log(`INSERT INTO poll (uid, content, tid, type) VALUES (${UUID}, ${poll_name}, ${tag}, 'balance')`);
	for (var index in selections) {
		console.log(`INSERT INTO selection (pid, content) VALUES (pid, ${selections[index]})`);
	}
	res.sendStatus(200);
});

app.post('/signup', (req, res) => {
	var uid = req.body.UUID.split("_")[1];
	var gender = req.body.gender;
	var age = req.body.age;
	var jobid = req.body.job;
	console.log(`INSERT INTO user (uid, gender, age, job) VALUES (${uid}, ${gender}, ${age}, ${jobid})`);
	res.sendStatus(200);
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
			tags.push(rows[index].name);
		}
		res.setHeader('Content-Type', 'application/json');
		res.json({tagList: tags});
	});
});

app.post('/searchtag', (req, res) => {
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
			tags.push(rows[index].name);
		}
		res.json({tagList: tags});
	});
});

app.listen(port, () => {
	console.log(`Polling server listening on port ${port}`);
});
