const express = require('express');
const router = express.Router();
const usermanRoutes = router.route('/')
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
const admin = require('firebase-admin');
const serviceAccount = require('/home/seokhyeon/.firebase/serviceAccountKey.json');

router.post('/login', (req, res) => {
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

router.post('/signup', (req, res) => {
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
		var name = rows[0].name.split(' ')[1];
		var prefix = rows[0].name.split(' ')[0];
		db.query('INSERT INTO user (uid, prefix, name, gender, age, birthday, mbti) VALUES (?, ?, ?, ?, ?, DATE_SUB(CURRENT_DATE(), INTERVAL ? YEAR),?)', [uid, prefix, name, gender, age, age, mbti], (err, rows) => {
			if (err) throw err;
			db.query('UPDATE usernames SET used = TRUE WHERE name = ?', [name], (err, rows) => {
				if (err) throw err;
				res.sendStatus(200);
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
			res.json({isMyProfile: false, name: 'GUEST', prefix: '', ownPrefixList: [], profileImg: 'https://i.imgur.com/Z3P15Dj.png'})
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


module.exports = router;
