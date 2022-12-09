const express = require('express');
const router = express.Router();
const usermanRoutes = router.route('/')
const mysql = require('mysql');
const db = mysql.createConnection({
	host: '127.0.0.1',
	port: '54855',
	user: 'develop',
	password: 'cien14789*',
	database: 'polling'
});
const queries = require('../queries.js');
const bodyParser = require('body-parser');
const usernames = require('../defs/names.json');
const admin = require('firebase-admin');
const serviceAccount = require('/home/ubuntu/.firebase/serviceAccountKey.json');
const fs = require('fs');
const hostUrl = 'http://ec2-3-39-226-193.ap-northeast-2.compute.amazonaws.com:57043/';//'http://devcap.duckdns.org:57043/'

router.post('/signup', (req, res) => {
	var uid = req.body.UUID;
	var gender = req.body.gender;
	var age = req.body.age;
	var mbti = req.body.mbti;
	var url = hostUrl + 'images/profile/';
	var profile = req.body.profile;
	var birthday = req.body.birthday;
	var bdaypholder = 'DATE_SUB(CURRENT_DATE(), INTERVAL ' + age + ' YEAR)'
	if (birthday == '' || birthday == null) {
		birthday = bdaypholder;
	}
	if (profile == '' || profile == null) {
		profile = url + 'profile0.png';
	}
	if (uid.length != 28) {
		res.sendStatus(400);
	}
	db.query('SELECT name FROM usernames WHERE used = FALSE ORDER BY RAND() LIMIT 1', (err, rows) => {
		if (err) throw err;
		var name = rows[0].name.split(' ')[1];
		var prefix = rows[0].name.split(' ')[0];
		db.query('INSERT INTO user (uid, prefix, name, gender, age, birthday, mbti, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [uid, prefix, name, gender, age, birthday, mbti, profile], (err, rows) => {
			if (err) throw err;
			db.query('UPDATE usernames SET used = TRUE WHERE name = ?', [name], (err, rows) => {
				if (err) throw err;
				db.query('INSERT INTO userprefix (uid, prefix) VALUES (?, ?)', [uid, prefix], (err, rows) => {
					if (err) throw err;
					db.query('INSERT INTO userprofile (uid, profile_url) VALUES (?, ?)', [uid, profile]);
					res.sendStatus(200);
				});
			});
		});
	});
});

router.get('/allprefix', (req, res) => {
	var ret = {prefix: []};
	db.query('SELECT * FROM prefix', (err, rows) => {
		for (var index in rows) {
			ret.prefix.push(rows[index].name);
		}
		res.json(ret);
	});
});

router.get('/profile/:user/:target', (req, res) => {
	db.query(queries.userLookup, [req.params.target], (err, rows) => {
		if (req.params.user == 'null' && req.params.target == 'null') {
			res.json({isMyProfile: false, name: 'GUEST', prefix: '', ownPrefixList: [], profileImg: 'https://i.imgur.com/Z3P15Dj.png'});
			return;
		}
		if (rows[0] == undefined) {
			res.statusMessage = "Invalid request, database returned empty set";
			res.status(400).send(res.statusMessage);
			return;
		}
		var ret = {isMyProfile: req.params.user == req.params.target, name: rows[0].name, prefix: rows[0].prefix, ownPrefixList: [], profileImg: rows[0].image};
		for (var index in rows) {
			ret.ownPrefixList.push(rows[index].owned);
		}
		res.json(ret);
	});
});

router.post('/namechange', (req, res) => {
	var uid = req.body.UUID;
	var name = req.body.name;
	db.query('UPDATE user SET name = ? WHERE uid = ?', [name, uid], (err, rows) => {
		res.json({name: name});
	});
});

router.post('/prefixchange', (req, res) => {
	var uid = req.body.UUID;
	var prefix = req.body.prefix;
	db.query('UPDATE user SET prefix = ? WHERE uid = ?', [prefix, uid], (err, rows) => {
		res.json({prefix: prefix});
	});
});

router.post('/imagechange', (req, res) => {
	var uid = req.body.UUID;
	var image = req.body.index;
	var url = hostUrl + 'images/profile/profile' + image + '.jpeg';
	db.query('UPDATE user SET image = ? WHERE uid = ?', [url, uid], (err, rows) => {
		res.json({image: url});
	});
});

router.get('/profimgs/:uid', (req, res) => {
	var files = fs.readdirSync('./images/profile').length;
	var ret = {ownProfileImageList: []};
	db.query('SELECT profile_url FROM userprofile WHERE uid = ?', [req.params.uid], (err, rows) => {
		for (var i in rows) {
			var index = rows[i].profile_url.split('profile').pop().split('.')[0];
			ret.ownProfileImageList.push({imgId: index, profileImg: rows[i].profile_url});
		}
		res.json(ret);
	});
});

router.get('/rawuserdata/:uid', (req, res) => {
	db.query('SELECT * FROM user WHERE uid = ?', [req.params.uid], (err, rows) => {
		var ret = {
			uid: rows[0].uid,
			prefix: rows[0].prefix,
			name: rows[0].name,
			age: rows[0].age,
			gender: rows[0].gender,
			mbti: rows[0].mbti,
			image: rows[0].image,
			birthday: rows[0].birthday
		}
		res.json(ret);
	});
});

router.post('/update/usertoken', (req, res) => {
	var uid = req.body.UUID;
	var tok = req.body.token;
	db.query('UPDATE user SET fcm = ? WHERE uid = ?', [tok, uid], (err, rows) => {
		res.sendStatus(200);
	});
});

router.post('/reward/giveprofile', (req, res) => {
	var uid = req.body.UUID;
	var profile_url = hostUrl + '/images/profile/profile' + req.body.profile_index + '.png';
	db.query('INSERT INTO userprofile (uid, profile_url) VALUES (?, ?)', [uid, profile_url], (err, rows) => {
		if (err) throw err;
	});
});

router.post('/reward/giveprefix', (req, res) => {
	var uid = req.body.UUID;
	var prefix = req.body.prefix;
	db.query('INSERT INTO userprefix (uid, prefix) VALUES (?, ?)', [uid, prefix], (err, rows) => {
		if (err) throw err;
	});
});

router.get('/interest/:uid/', (req, res) => {
	db.query('select * from recommendation_rating natural join tag where uid = ? order by rating desc', [req.params.uid], (err, rows) => {
		var ret = {tags: [rows[0].name, rows[1].name, rows[2].name]};
		res.json(ret);
	});
});

module.exports = router;
