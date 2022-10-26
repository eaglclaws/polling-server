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

const getLastUid = 'SELECT uid FROM user ORDER BY uid DESC LIMIT 1;';

const recTag = 'SELECT * FROM tag';

const searchTag = 'SELECT * FROM tag WHERE name LIKE ?;';

const topTags = 'SELECT * FROM tag LIMIT 5';

module.exports = {topTenPosts, countAllPosts, getResult, getLastUid, recTag, searchTag, topTags};
