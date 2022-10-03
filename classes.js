class Poll {
	tags;
	user;
	content;
	constructor(content, user, tags) {
		this.content = content;
		this.user = user;
		this.tags = tags;
	}

}

class Post {
	poll;
	comments;
	type;
	time;
	likes;
	constructor(poll, comments, type, time, likes) {
		this.poll = poll;
		this.comments = comments;
		this.type = type;
		this.time = time;
		this.likes = likes;
	}
}

class PostFactory {
	createPost(type) {
		if (type === "poll") {
			return Post(null, null, type, null, null);
		} else if (type === "balance") {
			return Post(null, null, type, null, null);
		} else if (type === "war") {
			return Post(null, null, type, null, null);
		}
	}
}
