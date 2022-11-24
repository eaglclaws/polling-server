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
const escape = require('regexp.escape');
const sw = require('remove-stopwords');

python.ex`from nltk.sejong import ssem`
python.ex`import konlpy`
python.ex`okt = konlpy.tag.Okt()`

router.post('/rectag', async (req, res) => {
	db.query(queries.recTag, async (err, rows) => {
		if (err) throw err;
		var tags = [];
		var taglist = [];
		var words = sw.removeStopwords(req.body.poll_name.split(' '), stopwords);
		console.log(words);
		var words1 = sw.removeStopwords(words, 'ko');
		console.log(words1);
		var words2 = sw.removeStopwords(words1, ['투표', '투표가', '투표는', '투표입니다.', '대한']).join(' ');
		console.log(words2);
		for (var index in rows) {
			taglist[rows[index].tid] = rows[index].name;
		}
		for (var i = 0; i < taglist.length; i++) {
			if (taglist[i] == undefined) {
				taglist[i] = '';
			} 
		}
		python.ex`
			taglist = ${taglist}
			sim = list()
			words = okt.nouns(${words2})
			for index, tag in enumerate(taglist):
				sim.append(0)
				tentry = ssem.entrys(tag)
				if not tentry:
					continue
				tsense = tentry[0].senses()
				if not tsense:
					continue
				for word in words:
					entry = ssem.entrys(word)
					if not entry:
						continue
					sense = entry[0].senses()
					if not sense:
						continue
					sim[index] = sim[index] + sense[0].wup_similarity(tsense[0])
		`
		var list = await python`sim`;
		var results = [];
		for (var i = 0; i < taglist.length; i++) {
			results.push({tid: i, tag: taglist[i], sim: list[i]});
		}
		var simres = results.sort((a, b) => {
			return b.sim - a.sim;
		});
		for (var i = 0; i < 3; i++) {
			tags.push({tagId: 'tid_' + simres[i].tid, tag: simres[i].tag})
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

router.get('/testnlp', async (req, res) => {
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
