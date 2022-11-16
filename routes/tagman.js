'use strict';

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
const assert = require('assert');
const pythonBridge = require('python-bridge');
const python = pythonBridge({python: 'python3'});
const stopwords = require('stopwords-ko');

python.ex`from nltk.sejong import ssem`
python.ex`import konlpy`
python.ex`okt = konlpy.tag.Okt()`

router.post('/rectag', (req, res) => {
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

router.post('/searchtag', (req, res) => {
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

module.exports = router;
