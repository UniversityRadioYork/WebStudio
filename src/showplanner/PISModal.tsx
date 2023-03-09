import React, { useEffect, useState } from "react";
import Modal from "react-modal";
import { broadcastApiRequest, getLatestNewsItem, NewsEntry } from "../api";
import { Button } from "reactstrap";
import { FaTimes } from "react-icons/fa";

function DevWarning() {
  if (process.env.REACT_APP_PRODUCTION === "true") {
    return null;
  }
  const wsUrl =
    process.env.REACT_APP_MYRADIO_NONAPI_BASE + "/MyRadio/webstudio";
  return (
    <>
      <div className="p-2 alert-warning">
        <h2>Development Version</h2>
        <strong>You are using a development version of WebStudio.</strong> This
        version is NOT tested and may have severe bugs and performance problems.
        <br />
        <em>
          <strong>DO NOT BROADCAST LIVE SHOWS USING THIS VERSION!</strong>
        </em>
        <br />
        For the latest and greatest tested WebStudio, go to{" "}
        <a href={wsUrl}>{wsUrl}</a>.
      </div>
      <hr />
    </>
  );
}

function StudioWarning() {
  const [isInStudio, setIsInStudio] = useState<boolean | null>(null);
  useEffect(() => {
    const abortController = new AbortController();
    async function checkStudio() {
      const result = await broadcastApiRequest(
        "/isInStudio",
        "GET",
        {},
        abortController.signal
      );
      setIsInStudio(result);
    }
    checkStudio();
    return () => abortController.abort();
  }, []);
  if (!isInStudio) {
    return null;
  }
  return (
    <>
      <div className="p-2 alert-danger">
        <h2>WARNING</h2>
        <p>
          You appear to be using WebStudio in the URY Studios. You probably want
          to use BAPS3 instead.{" "}
          <strong>
            Do not use WebStudio to broadcast a live show from the studios!
          </strong>
        </p>
        <p>If BAPS is not open, use the shortcut on the desktop.</p>
        <p>
          If you're not sure what this means, message #studio-faults in Slack
          for help!
        </p>
      </div>
      <hr />
    </>
  );
}

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
      <h1 className="d-inline">Presenter News</h1>
      <Button onClick={close} className="float-right pt-1" color="primary">
        <FaTimes />
      </Button>
      <hr className="mt-1 mb-3" />
      <DevWarning />
      <StudioWarning />
      {(news === "loading" || news === "not_loaded") && (
        <p>Loading the news...</p>
      )}
      {news === "no_news" && <p>There is no news.</p>}
      {news === "error" && (
        <p>There was an error getting the news. Computing are aware.</p>
      )}
      {typeof news === "object" && (
        <div>
          <em>
            ~{news.author}, {news.posted}
          </em>
          <br />
          <p dangerouslySetInnerHTML={{ __html: news.content }} />
        </div>
      )}
      <br />
      <Button onClick={close} color="primary">
        <FaTimes /> Close
      </Button>
    </Modal>
  );
}
