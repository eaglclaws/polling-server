const express = require('express');
const app = express();
const mysql = require('mysql');
const admin = require('firebase-admin');
const port = 57043;

const serviceAccount = require('.firebase/serviceAccountKey.json');

db = mysql.createConnection({
	host: '127.0.0.1',
	port: '54855',
	user: 'develop',
	password: 'cien14789*',
	database: 'polling'
});

admin.initializeApp({
	credential: admin.credential.cert(serviceAccount)
});

app.get('/', (req, res) => {
	res.send('Hello World!');
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

//This function is not under development; do not uncomment
//app.post('/login', (res, req) => {
//	var idToken = res.body.token;
//	admin.getAuth()
//		.verifyIdToken(idToken)
//		.then((decodedToken) => {
//			const uid = decodedToken.uid;
//			TODO: Add stuff here
//		})
//		.catch((error) => {
//			TODO: Handle error
//		});
//});

app.listen(port, () => {
	console.log(`Example app listening on port ${port}`);
});
