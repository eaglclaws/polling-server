const topTenPosts = 
'SELECT postId, postType, poster as posterId, timeBefore, userCount, storyText, likes, comments, selectionId, selectionText FROM (SELECT aux.*, selectionId, selectionText ' +
'FROM ( ' +
'SELECT postId, postType, posterId, timeBefore, userCount, storyText, likes, comments ' +
'FROM ( ' +
'SELECT poll.pid as postId, poll.type as postType, poll.uid as posterId, TIMESTAMPDIFF(MINUTE, poll.time, CURRENT_TIMESTAMP()) as timeBefore, COUNT(polldone.uid) as userCount, poll.content as storyText ' +
'FROM poll ' +
'LEFT JOIN polldone ON poll.pid = polldone.pid ' +
'GROUP BY poll.pid ' +
') as userCounter ' +
'LEFT JOIN ( ' +
'SELECT poll.pid, COUNT(polllikes.uid) as likes ' +
'FROM poll ' +
'LEFT JOIN polllikes ON poll.pid = polllikes.pid ' +
'GROUP BY poll.pid ' +
') as likeCounter ON userCounter.postId = likeCounter.pid ' +
'LEFT JOIN ( ' +
'SELECT poll.pid, COUNT(comment.cid) as comments ' +
'FROM poll ' +
'LEFT JOIN comment ON poll.pid = comment.pid ' +
'GROUP BY poll.pid ' +
') as commentCounter ON userCounter.postId = commentCounter.pid ' +
'ORDER BY timeBefore ' +
'LIMIT 10 ' +
'OFFSET ? ' +
') as aux ' +
'LEFT JOIN ( ' +
'SELECT selection.pid, selection.sid as selectionId, selection.content as selectionText FROM selection ' +
') as optionList ON aux.postId = optionList.pid) as wrapper INNER JOIN (SELECT uid, name as poster FROM user) as u ON u.uid = wrapper.posterId;';

const countAllPosts = 'SELECT COUNT(*) as sum FROM poll';

const getResult =
'SELECT selectionId, content, percent ' +
'FROM (' +
	'SELECT sid as selectionId, COUNT(*) * 100 / SUM(COUNT(*)) OVER () as percent ' +
	'FROM polldone ' +
	'WHERE pid = ? ' +
	'GROUP BY sid ' +
	'ORDER BY sid ' +
') as calc ' +
'INNER JOIN selection ON calc.selectionId = selection.sid;';

const getByGender =
'SELECT s.sid, s.content, s.gender, g.percent ' +
'FROM (' +
	'SELECT sid, content, name as gender ' +
	'FROM selection, gender ' +
	'WHERE pid = ? ' +
') as s ' +
'LEFT JOIN (' +
	'SELECT sid, gender, COUNT(*) * 100 / SUM(COUNT(*)) OVER (PARTITION BY gender) AS percent ' +
	'FROM polldone '+
	'INNER JOIN user ON polldone.uid = user.uid ' +
	'WHERE pid = ? '+
	'GROUP BY sid, gender '+
') as g ON s.sid = g.sid and s.gender = g.gender ' +
'ORDER BY gender';

const getByAge =
'SELECT s.sid, s.age, g.percent ' +
'FROM (' +
	'SELECT sid, age.age ' +
	'FROM selection, (' +
		'SELECT age ' +
		'FROM polldone ' +
		'INNER JOIN user ON polldone.uid = user.uid ' +
		'WHERE pid = ? ' +
		'GROUP BY age' +
	') as age ' +
	'WHERE pid = ? ' +
') as s ' +
'LEFT JOIN (' +
	'SELECT sid, age, COUNT(*) * 100 / SUM(COUNT(*)) OVER (PARTITION BY age) AS percent ' +
	'FROM polldone '+
	'INNER JOIN user ON polldone.uid = user.uid ' +
	'WHERE pid = ? '+
	'GROUP BY sid, age '+
') as g ON s.sid = g.sid and s.age = g.age ' +
'ORDER BY age;';

const getByJob =
'SELECT s.sid, s.job, g.percent ' +
'FROM (' +
	'SELECT sid, job.name as job ' +
	'FROM selection, (' +
		'SELECT job.name ' +
		'FROM polldone ' +
		'INNER JOIN user ON polldone.uid = user.uid ' +
		'INNER JOIN job on user.job = job.jid ' +
		'WHERE pid = ? ' +
		'GROUP BY jid' +
	') as job ' +
	'WHERE pid = ? ' +
') as s ' +
'LEFT JOIN (' +
	'SELECT sid, job.name as job, COUNT(*) * 100 / SUM(COUNT(*)) OVER (PARTITION BY jid) AS percent ' +
	'FROM polldone '+
	'INNER JOIN user ON polldone.uid = user.uid ' +
	'INNER JOIN job ON user.job = job.jid ' +
	'WHERE pid = ? '+
	'GROUP BY sid, jid '+
') as g ON s.sid = g.sid and s.job = g.job ' +
'ORDER BY job;';

const getByMbti =
'SELECT s.sid, s.content, s.mbti, g.percent ' +
'FROM (' +
	'SELECT sid, content, name as mbti ' +
	'FROM selection, mbti ' +
	'WHERE pid = ? ' +
') as s ' +
'LEFT JOIN (' +
	'SELECT sid, mbti, COUNT(*) * 100 / SUM(COUNT(*)) OVER (PARTITION BY mbti) AS percent ' +
	'FROM polldone '+
	'INNER JOIN user ON polldone.uid = user.uid ' +
	'WHERE pid = ? '+
	'GROUP BY sid, mbti '+
') as g ON s.sid = g.sid and s.mbti = g.mbti ' +
'ORDER BY mbti';

const detailGender =
'SELECT calc.sid as selectionId, percent ' +
'FROM (' +
	'SELECT sid, COUNT(*) * 100 / SUM(COUNT(*)) OVER () AS percent ' +
	'FROM (' +
		'SELECT polldone.* ' +
		'FROM polldone ' +
		'INNER JOIN user ON polldone.uid = user.uid ' +
		'WHERE pid = ? AND gender = ? '+
	') AS aux ' +
	'GROUP BY sid ' +
	'ORDER BY sid ' +
') AS calc ' +
'INNER JOIN selection ON calc.sid = selection.sid';

const getLastUid = 'SELECT uid FROM user ORDER BY uid DESC LIMIT 1;';

const recTag = 'SELECT * FROM tag';

const searchTag = 'SELECT * FROM tag WHERE name LIKE ?;';

const topTags = 'SELECT * FROM tag LIMIT 5';

module.exports = {detailGender, topTenPosts, countAllPosts, getResult, getByGender, getByAge, getByJob, getByMbti, getLastUid, recTag, searchTag, topTags};
