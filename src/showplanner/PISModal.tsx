import React, { useEffect, useState } from "react";
import Modal from "react-modal";
import { getLatestNewsItem, NewsEntry } from "../api";
import { Button } from "reactstrap";

export function PisModal({
  close,
  isOpen,
}: {
  close: () => any;
  isOpen: boolean;
}) {
  const [news, setNews] = useState<
    NewsEntry | "not_loaded" | "loading" | "no_news" | "error"
  >("not_loaded");
  useEffect(() => {
    async function getNews() {
      setNews("loading");
      try {
        const news = await getLatestNewsItem(4 /* PIS */);
        if (news === null) {
          setNews("no_news");
        } else {
          setNews(news);
        }
      } catch (e) {
        console.error(e);
        setNews("error");
      }
    }
    if (isOpen && news === "not_loaded") {
      getNews();
    }
  }, [isOpen, news]);

  return (
    <Modal isOpen={isOpen} onRequestClose={close}>
      <h1>Presenter News</h1>
      {(news === "loading" || news === "not_loaded") && (
        <p>Loading the news...</p>
      )}
      {news === "no_news" && <p>There is no news.</p>}
      {news === "error" && (
        <p>There was an error getting the news. Computing are aware.</p>
      )}
      {typeof news === "object" && (
        <div style={{ fontSize: "90%" }}>
          <p dangerouslySetInnerHTML={{ __html: news.content }} />
          <em>
            ~{news.author}, {news.posted}
          </em>
        </div>
      )}
      <Button onClick={close} color="primary">
        Close
      </Button>
    </Modal>
  );
}
