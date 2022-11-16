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

const getPosts =
'SELECT poll.*, selection.* ' +
'FROM ( ' +
    'SELECT poll.*, total ' +
    'FROM ( ' +
        'SELECT poll.*, COALESCE(comment.count, 0) as comments ' +
        'FROM ( ' +
            'SELECT poll.*, COALESCE(polllikes.count, 0) as likes ' +
            'FROM ( ' +
                'SELECT poll.*, COALESCE(polldone.count, 0) AS count ' +
                'FROM ( ' +
                    'SELECT poll.pid, poll.type, poll.content, TIMESTAMPDIFF(MINUTE, poll.time, CURRENT_TIMESTAMP()) AS time, user.uid, user.image, user.prefix, user.name ' +
                    'FROM ( ' +
						'SELECT * FROM poll ' +
						'WHERE type = ? ' +
                    ') AS poll ' +
                    'INNER JOIN user ON poll.uid = user.uid ' +
					'ORDER BY time LIMIT 10 OFFSET ? ' +
                ') AS poll ' +
                'LEFT JOIN ( ' +
                    'SELECT pid, COUNT(*) as count ' +
                    'FROM polldone ' +
                    'GROUP BY pid ' +
                ') AS polldone ON poll.pid = polldone.pid ' +
            ') AS poll ' +
            'LEFT JOIN ( ' +
                'SELECT pid, COUNT(*) as count ' +
                'FROM polllikes ' +
                'GROUP BY pid ' +
            ') AS polllikes ON poll.pid = polllikes.pid ' +
        ') AS poll ' +
        'LEFT JOIN ( ' +
            'SELECT pid, COUNT(*) as count ' +
            'FROM comment ' +
            'GROUP BY pid ' +
        ') AS comment ON poll.pid = comment.pid ' +
    ') AS poll, ( ' +
        'SELECT COUNT(*) AS total ' +
		'FROM poll ' +
		'WHERE type = ? ' +
    ') AS total ' +
') AS poll ' +
'INNER JOIN ( ' +
    'SELECT pid, sid, content AS selection ' +
    'FROM selection ' +
') AS selection ON poll.pid = selection.pid;';

const getPostById =
'SELECT poll.*, selection.* ' +
'FROM ( ' +
    'SELECT poll.*, total ' +
    'FROM ( ' +
        'SELECT poll.*, COALESCE(comment.count, 0) as comments ' +
        'FROM ( ' +
            'SELECT poll.*, COALESCE(polllikes.count, 0) as likes ' +
            'FROM ( ' +
                'SELECT poll.*, COALESCE(polldone.count, 0) AS count ' +
                'FROM ( ' +
                    'SELECT poll.pid, poll.type, poll.content, TIMESTAMPDIFF(MINUTE, poll.time, CURRENT_TIMESTAMP()) AS time, user.uid, user.image, user.prefix, user.name ' +
                    'FROM ( ' +
						'SELECT * FROM poll ' +
						'WHERE pid = ? ' +
                    ') AS poll ' +
                    'INNER JOIN user ON poll.uid = user.uid ' +
                ') AS poll ' +
                'LEFT JOIN ( ' +
                    'SELECT pid, COUNT(*) as count ' +
                    'FROM polldone ' +
                    'GROUP BY pid ' +
                ') AS polldone ON poll.pid = polldone.pid ' +
            ') AS poll ' +
            'LEFT JOIN ( ' +
                'SELECT pid, COUNT(*) as count ' +
                'FROM polllikes ' +
                'GROUP BY pid ' +
            ') AS polllikes ON poll.pid = polllikes.pid ' +
        ') AS poll ' +
        'LEFT JOIN ( ' +
            'SELECT pid, COUNT(*) as count ' +
            'FROM comment ' +
            'GROUP BY pid ' +
        ') AS comment ON poll.pid = comment.pid ' +
    ') AS poll, ( ' +
        'SELECT COUNT(*) AS total ' +
		'FROM poll ' +
    ') AS total ' +
') AS poll ' +
'INNER JOIN ( ' +
    'SELECT pid, sid, content AS selection ' +
    'FROM selection ' +
') AS selection ON poll.pid = selection.pid;';


const countAllPosts = 'SELECT COUNT(*) as sum FROM poll';

const getResult =
'SELECT selectionId, content, percent ' +
'FROM (' +
	'SELECT sid, COUNT(*) * 100 / SUM(COUNT(*)) OVER () as percent ' +
	'FROM polldone ' +
	'WHERE pid = ? ' +
	'GROUP BY sid ' +
	'ORDER BY sid ' +
') as calc ' +
'RIGHT JOIN (SELECT sid AS selectionId, content FROM selection WHERE pid = ?) as selection ON calc.sid = selection.selectionId;';

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
	'SELECT sid, age.a as age ' +
	'FROM selection, (' +
		'SELECT TIMESTAMPDIFF(YEAR, birthday, CURRENT_DATE()) as a' +
		'FROM polldone ' +
		'INNER JOIN user ON polldone.uid = user.uid ' +
		'WHERE pid = ? ' +
		'GROUP BY a ' +
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

const detailAge =
'SELECT sel.sid as selectionId, sel.age, calc.percent ' +
'FROM ( ' +
'    SELECT selection.sid, age.value as age ' +
'    FROM selection, age ' +
'    WHERE pid = ? and value BETWEEN ? and ?' +
') AS sel ' +
'LEFT JOIN ( ' +
'    SELECT aux.sid, aux.age, COUNT(*) * 100 / SUM(COUNT(*)) OVER () AS percent ' +
'    FROM ( ' +
'        SELECT polldone.sid, user.age ' +
'        FROM polldone ' +
'        INNER JOIN user ON polldone.uid = user.uid ' +
'        WHERE pid = ? and age BETWEEN ? and ?' +
'    ) AS aux ' +
'    GROUP BY sid, age ' +
'    ORDER BY sid, age ' +
') AS calc ON sel.sid = calc.sid and sel.age = calc.age;'; 

const detailMbti =
'SELECT s.sid as selectionId, s.mbti, c.percent ' +
'FROM ( ' +
    'SELECT sid, name as mbti ' +
    'FROM selection, mbti ' +
    'WHERE pid = ? and name LIKE ? ' +
') AS s ' +
'LEFT JOIN ( ' +
    'SELECT sid, mbti, COUNT(*) * 100 / SUM(COUNT(*)) OVER () AS percent ' +
    'FROM polldone ' +
    'INNER JOIN user ON polldone.uid = user.uid ' +
    'WHERE pid = ? and mbti LIKE ? ' +
    'GROUP BY sid, mbti ' +
') AS c ON s.sid = c.sid and s.mbti = c.mbti;';

const getLastUid = 'SELECT uid FROM user ORDER BY uid DESC LIMIT 1;';

const recTag = 'SELECT * FROM tag';

const searchTag = 'SELECT * FROM tag WHERE name LIKE ?;';

const topTags = 'SELECT * FROM tag LIMIT 5';

const userLookup =
'SELECT user.*, userprefix.prefix AS owned ' +
'FROM (' +
	'SELECT uid, prefix, name, image ' +
	'FROM user ' +
	'WHERE uid = ? ' +
') AS user ' +
'INNER JOIN userprefix ON user.uid = userprefix.uid ' +
'ORDER BY user.uid;';

const getBattle =
'select poll.*, selection.sid, selection.content ' +
'from ( ' +
'select poll.pid, type, TIMESTAMPDIFF(MINUTE, CURRENT_TIMESTAMP(), end) as timeleft ' +
'from poll ' +
'inner join battle on battle.pid = poll.pid ' +
') as poll ' +
'inner join selection on poll.pid = selection.pid; ';

const getComments =
'select comment.*, COALESCE(polldone.sid, 0) as sid ' +
'from (select user.uid, user.image, user.prefix, user.name, content, TIMESTAMPDIFF(MINUTE, time, CURRENT_TIMESTAMP) as time from ' +
'comment inner join user on comment.uid = user.uid ' +
'where pid = ?) as comment ' +
'left join ( ' +
	'select uid, sid from polldone where pid = ? ' +
') as polldone on comment.uid = polldone.uid; ';

module.exports = {getPostById, getComments, userLookup, getPosts, detailMbti, detailAge, detailGender, topTenPosts, countAllPosts, getResult, getByGender, getByAge, getByJob, getByMbti, getLastUid, recTag, searchTag, topTags};
