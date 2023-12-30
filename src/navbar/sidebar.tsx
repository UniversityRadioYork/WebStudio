import React from "react";
import { FaCog } from "react-icons/fa";
import appLogo from "../assets/images/presenterlogo.png";

export function SidebarDialogue(close: any) {
  return (
    <div className="mt-3 text-center">
      <img className="logo px-5 mb-3" src={appLogo} alt="BAPS3" />
      <h2 className="display-4">BAPS3</h2>
      <h3 className="h3">Presenter</h3>
      <p>
        <strong>Broadcast And Presenting Suite</strong>
      </p>
      <hr />
      <a href="/" target="_blank">
        <div className="btn btn-outline-dark">
          <FaCog size={15} /> Server Settings
        </div>
      </a>
      <hr />
      <p>
        Brought to you by
        <br />
        <strong>The URY Computing Team</strong>
        <br />
        since 2020.
      </p>
      <hr />
      <p>
        Based on the legendary BAPS 1 &amp; 2
        <br />
        <strong>2004 - 2021</strong>
        <br />
        Built upon the ideas and learnings of the many previous attempts of
        BAPS3.
      </p>
    </div>
  );
}
