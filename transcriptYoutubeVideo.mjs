import ytdl from "ytdl-core";
import https from "https";

const removeHTMLTags = (text) => {
  return text.replace(/<\/?[^>]+(>|$)/g, "");
};
const fetchContent = (url) => {
  return new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        let data = "";
        response.on("data", (chunk) => {
          data += chunk;
        });
        response.on("end", () => {
          resolve(data);
        });
      })
      .on("error", (err) => {
        reject(err.message);
      });
  });
};

const transcriptYoutubeVideo = async (videoUrl) => {
  try {
    const info = await ytdl.getInfo(videoUrl);
    const track =
      info.player_response.captions.playerCaptionsTracklistRenderer
        .captionTracks[0].baseUrl;
    if (track) {
      const content = await fetchContent(track);
      const plainText = removeHTMLTags(content);

      return plainText;
    } else {
      console.log("Legendas não disponíveis para este vídeo.");

      return null;
    }
  } catch (error) {
    console.error("Erro ao baixar legendas:", error);

    return null;
  }
};

export default transcriptYoutubeVideo;
