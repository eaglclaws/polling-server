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

CREATE TABLE selection (
	sid INT UNSIGNED NOT NULL AUTO_INCREMENT,
	content TEXT NOT NULL,
	pid INT UNSIGNED NOT NULL,
	PRIMARY KEY (sid),
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
	sid INT UNSIGNED NOT NULL,
	FOREIGN KEY (pid) REFERENCES poll(pid),
	FOREIGN KEY (uid) REFERENCES user(uid),
	FOREIGN KEY (sid) REFERENCES option(sid),
	CONSTRAINT did PRIMARY KEY (pid, uid)
);

CREATE TABLE polllikes (
	pid INT UNSIGNED NOT NULL,
	uid INT UNSIGNED NOT NULL,
	FOREIGN KEY (pid) REFERENCES poll(pid),
	FOREIGN KEY (uid) REFERENCES user(uid),
	CONSTRAINT lpid PRIMARY KEY (pid, uid)
);

CREATE TABLE tag (
	tid INT UNSIGNED NOT NULL AUTO_INCREMENT,
	name TEXT NOT NULL,
	PRIMARY KEY (tid)
);

CREATE TABLE polltag (
	tid INT UNSIGNED NOT NULL,
	pid INT UNSIGNED NOT NULL,
	CONSTRAINT ptid PRIMARY KEY(tid, pid)
);

-- 위에 대한 dummy data
INSERT INTO tag (name) VALUES ('동물'), ('취향'), ('예술'), ('문학'), ('프로그래밍'), ('사회');

INSERT INTO job (name) VALUES ('대학생'), ('프로그래머'), ('행정');

INSERT INTO user (name, age, gender, job) VALUES ('배고픈 부엉이', 20, 'M', 1), ('빛나는 참새', 21, 'F', 2), ('황당한 오소리', 26, 'M', 3), ('재빠른 비버', 22, 'F', 1), ('귀여운 너구리', 22, 'M', 1);

INSERT INTO poll (content, time, uid, type) VALUES ('버스 뒷문으로 타도 괜찮을까?', CURRENT_TIMESTAMP(), 1, 'polling');
INSERT INTO selection (content, pid) VALUES ('문제 없지!', 1), ('안되지!', 1);
INSERT INTO polltag (tid, pid) VALUES (6, 1);

INSERT INTO poll (content, time, uid, type) VALUES ('제일 좋아하는 강아지 품종 골라줘!', CURRENT_TIMESTAMP(), 1, 'polling');
INSERT INTO selection (content, pid) VALUES ('푸들', 2), ('시츄', 2), ('시바견', 2), ('불독', 2), ('코기', 2);
INSERT INTO polltag (tid, pid) VALUES (1, 2), (2, 2);

INSERT INTO poll (content, time, uid, type) VALUES ('프로그래밍 언어 쓰는거 알려줘!', CURRENT_TIMESTAMP(), 2, 'polling');
INSERT INTO selection (content, pid) VALUES ('전통파 C!', 3), ('실무는 Java 써야지!', 3), ('웹 개발도 프로그래밍이라고! Javasript 잊지마!', 3);
INSERT INTO polltag (tid, pid) VALUES (2, 3), (5, 3);

INSERT INTO poll (content, time, uid, type) VALUES ('부먹? 찍먹?', CURRENT_TIMESTAMP(), 3, 'polling');
INSERT INTO selection (content, pid) VALUES ('부먹', 4), ('찍먹', 4);
INSERT INTO polltag (tid, pid) VALUES (2, 4);

INSERT INTO polldone (pid, uid, sid) VALUES (1, 1, 2), (1, 2, 2), (1, 3, 2), (1, 4, 2), (1, 5, 1);
INSERT INTO polldone (pid, uid, sid) VALUES (2, 1, 3), (2, 2, 4), (2, 3, 5), (2, 4, 6), (2, 5, 7);
INSERT INTO polldone (pid, uid, sid) VALUES (3, 1, 8), (3, 2, 9), (3, 3, 10), (3, 4, 10);
INSERT INTO polldone (pid, uid, sid) VALUES (4, 1, 11), (4, 2, 11), (4, 3, 12), (4, 4, 12), (4, 5, 12);

INSERT INTO polllikes (pid, uid) VALUES (1, 2), (1, 3), (1, 4);
INSERT INTO polllikes (pid, uid) VALUES (2, 2), (2, 3), (2, 4), (2, 5);
INSERT INTO polllikes (pid, uid) VALUES (3, 1), (3, 2), (3, 3), (3, 4), (3, 5);
INSERT INTO polllikes (pid, uid) VALUES (4, 3);

INSERT INTO comment (content, uid, pid) VALUES ('뒷문으로 타면 좀 민폐이지 않나?', 2, 1);

INSERT INTO commentlike (cid, uid, liked) VALUES (1, 1, TRUE), (1, 2, TRUE), (1, 3, TRUE), (1, 4, TRUE), (1, 5, FALSE);

-- 주의: 아래에 있는 {x}는 모두 자리 채움 용, node.js mysql 사용시, ?로 대체
-- 포스트 10개 씩 반환
SELECT aux.*, selectionId, selectionText
FROM (
	SELECT postId, postType, posterId, timeBefore, userCount, storyText, likes, comments
	FROM (
		SELECT poll.pid as postId, poll.type as postType, poll.uid as posterId, TIMESTAMPDIFF(MINUTE, poll.time, CURRENT_TIMESTAMP()) as timeBefore, COUNT(polldone.uid) as userCount, poll.content as storyText
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
	LIMIT 2
	OFFSET 0
) as aux
LEFT JOIN (
	SELECT selection.pid, selection.sid as selectionId, selection.content as selectionText FROM selection
) as optionList ON aux.postId = optionList.pid;

-- 유저 선택지 반영
INSERT INTO polldone (pid, uid, sid)
VALUES ({0}, {1}, {2})
ON DUPLICATE KEY UPDATE opid = {2};

-- 투표 결과 반환
SELECT sid, content, percent
FROM (
	SELECT sid as selectionId, COUNT(*) * 100 / SUM(COUNT(*)) OVER () as percent
	FROM polldone
	WHERE pid = {0}
	GROUP BY sid
	ORDER BY sid
) as calc
INNER JOIN selection ON calc.sid = selection.sid;

-- 투표 투고
INSERT INTO poll (uid, type, content, time) VALUES ({0}, {1}, {2}, CURRENT_TIMESTAMP());
INSERT INTO polltag (tid, pid) VALUES ({0}, {1});
INSERT INTO selection (content, pid) VALUES ({0}, {1});

-- 개인정보 입력
INSERT INTO user (uid, gender, age, job, name) VALUES ({0}, {1}, {2}, {3}, {4});
