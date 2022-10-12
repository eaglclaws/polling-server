CREATE TABLE type (
	name TEXT NOT NULL,
	PRIMARY KEY (name)
);
INSERT INTO type VALUES
	('polling'),
	('balance'),
	('battle');

CREATE TABLE gender (
	name TEXT NOT NULL,
	PRIMARY KEY (name)
);
INSERT INTO gender VALUES
	('M'),
	('F'),
	('N');

CREATE TABLE job (
	jid INT UNSIGNED NOT NULL AUTO_INCREMENT,
	name TEXT NOT NULL,
	PRIMARY KEY (jid)
);

CREATE TABLE user (
	uid INT UNSIGNED NOT NULL AUTO_INCREMENT, -- TODO: EDIT WHEN FIREBASE AUTH SETUP IS DONE
	name TEXT NOT NULL,
	age INT UNSIGNED NOT NULL,
	gender TEXT NOT NULL,
	job INT UNSIGNED NOT NULL,
	PRIMARY KEY (uid),
	FOREIGN KEY (gender) REFERENCES gender(name),
	FOREIGN KEY (job) REFERENCES job(jid)
);

CREATE TABLE poll (
	pid INT UNSIGNED NOT NULL AUTO_INCREMENT,
	content TEXT NOT NULL,
	time TIMESTAMP NOT NULL,
	uid INT UNSIGNED NOT NULL,
	type TEXT NOT NULL,
	PRIMARY KEY (pid),
	FOREIGN KEY (uid) REFERENCES user(uid),
	FOREIGN KEY (type) REFERENCES type(name)
);

CREATE TABLE option (
	opid INT UNSIGNED NOT NULL AUTO_INCREMENT,
	content TEXT NOT NULL,
	pid INT UNSIGNED NOT NULL,
	PRIMARY KEY (opid),
	FOREIGN KEY (pid) REFERENCES poll(pid)
);

CREATE TABLE comment (
	cid INT UNSIGNED NOT NULL AUTO_INCREMENT,
	content TEXT NOT NULL,
	uid INT UNSIGNED NOT NULL,
	pid INT UNSIGNED NOT NULL,
	PRIMARY KEY (cid),
	FOREIGN KEY (uid) REFERENCES user(uid),
	FOREIGN KEY (pid) REFERENCES poll(pid)
);

CREATE TABLE commentlikes (
	cid INT UNSIGNED NOT NULL,
	uid INT UNSIGNED NOT NULL,
	liked BOOLEAN NOT NULL,
	FOREIGN KEY (cid) REFERENCES comment(cid),
	FOREIGN KEY (uid) REFERENCES user(uid),
	CONSTRAINT lcid PRIMARY KEY (cid, uid)
);

CREATE TABLE polldone (
	pid INT UNSIGNED NOT NULL,
	uid INT UNSIGNED NOT NULL,
	opid INT UNSIGNED NOT NULL,
	FOREIGN KEY (pid) REFERENCES poll(pid),
	FOREIGN KEY (uid) REFERENCES user(uid),
	FOREIGN KEY (opid) REFERENCES option(opid),
	CONSTRAINT did PRIMARY KEY (pid, uid)
);

CREATE TABLE polllikes (
	pid INT UNSIGNED NOT NULL,
	uid INT UNSIGNED NOT NULL,
	FOREIGN KEY (pid) REFERENCES poll(pid),
	FOREIGN KEY (uid) REFERENCES user(uid),
	CONSTRAINT lpid PRIMARY KEY (pid, uid)
);

-- 포스트 10개 씩 반환
SELECT aux.*, selectionId, selectionText
FROM (
	SELECT postId, postType, posterId, timeBefore, userCount, storyText, likes, comments
	FROM (
		SELECT poll.pid as postId, poll.type as postType, poll.uid as posterId, TIMESTAMPDIFF(MINUTE, CURRENT_TIMESTAMP(), poll.time) as timeBefore, COUNT(polldone.uid) as userCount, poll.content as storyText
		FROM poll
		LEFT JOIN polldone ON poll.pid = polldone.pid
		GROUP BY poll.pid
	) as userCounter
	LEFT JOIN (
		SELECT poll.pid, COUNT(polllikes.uid) as likes
		FROM poll
		LEFT JOIN polllikes ON poll.pid = polllikes.pid
		GROUP BY poll.pid
	) as likeCounter ON userCounter.postId = likeCounter.pid
	LEFT JOIN (
		SELECT poll.pid, COUNT(comment.cid) as comments
		FROM poll
		LEFT JOIN comment ON poll.pid = comment.pid
		GROUP BY poll.pid
	) as commentCounter ON userCounter.postId = commentCounter.pid
	ORDER BY timeBefore
	LIMIT 10
	OFFSET ?
) as aux
LEFT JOIN (
	SELECT option.pid, option.opid as selectionId, option.content as selectionText
) as optionList ON aux.postId = optionList.pid

-- 유저 선택지 반영
INSERT INTO polldone (pid, uid, opid)
VALUES ({0}, {1}, {2})
ON DUPLICATE KEY UPDATE opid = {2};

-- 투표 결과 반환
SELECT opid as selectionId, COUNT(*) * 100 / SUM(COUNT(*)) OVER () as percent
FROM polldone
WHERE pid = {0}
GROUP BY opid;
