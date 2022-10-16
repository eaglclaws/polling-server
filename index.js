const express = require('express');
const app = express();
const mysql = require('mysql');
const port = 57043;

db = mysql.createConnection({
	host: '127.0.0.1',
	port: '54855',
	user: 'develop',
	password: 'cien14789*',
	database: 'pollingtesting'
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

app.listen(port, () => {
	console.log(`Example app listening on port ${port}`);
});
