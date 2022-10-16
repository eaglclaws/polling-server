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

app.get('/posts', (req, res) => {
	var sql =
'SELECT postId, postType, poster as posterId, timeBefore, userCount, storyText, likes, comments, selectionId, selectionText FROM (SELECT aux.*, selectionId, selectionText \
FROM ( \
	SELECT postId, postType, posterId, timeBefore, userCount, storyText, likes, comments \
	FROM ( \
		SELECT poll.pid as postId, poll.type as postType, poll.uid as posterId, TIMESTAMPDIFF(MINUTE, poll.time, CURRENT_TIMESTAMP()) as timeBefore, COUNT(polldone.uid) as userCount, poll.content as storyText \
		FROM poll \
		LEFT JOIN polldone ON poll.pid = polldone.pid \
		GROUP BY poll.pid \
	) as userCounter \
	LEFT JOIN ( \
		SELECT poll.pid, COUNT(polllikes.uid) as likes \
		FROM poll \
		LEFT JOIN polllikes ON poll.pid = polllikes.pid \
		GROUP BY poll.pid \
	) as likeCounter ON userCounter.postId = likeCounter.pid \
	LEFT JOIN ( \
		SELECT poll.pid, COUNT(comment.cid) as comments \
		FROM poll \
		LEFT JOIN comment ON poll.pid = comment.pid \
		GROUP BY poll.pid \
	) as commentCounter ON userCounter.postId = commentCounter.pid \
	ORDER BY timeBefore \
	LIMIT 2 \
	OFFSET 0 \
) as aux \
LEFT JOIN ( \
	SELECT selection.pid, selection.sid as selectionId, selection.content as selectionText FROM selection \
) as optionList ON aux.postId = optionList.pid) as wrapper INNER JOIN (SELECT uid, name as poster FROM user) as u ON u.uid = wrapper.posterId;';
	db.query(sql, (err, data, fields) => {
		if (err) throw err;
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
		res.setHeader('Content-Type', 'application/json');
		res.json({posts: posts});
	});
});

app.listen(port, () => {
	console.log(`Polling server listening on port ${port}`);
});
