const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: String,
  email: String,
  password: String,
  likedSongs: [
    {
      songId: String,
      title: String,
      artist: String,
      audioUrl: String,
      image: String
    }
  ]
});

module.exports = mongoose.model("User", userSchema);