import React from "react";
import { Nav, TabContent, TabPane, NavItem, NavLink } from "reactstrap";
import Modal from "react-modal";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../rootReducer";

import * as OptionsState from "./state";
import { MicTab } from "./MicTab";
import { AboutTab } from "./AboutTab";
import { StatsTab } from "./StatsTab";
import { MidiTab } from "./MidiTab";
import { AdvancedTab } from "./AdvancedTab";
import { FaTimes } from "react-icons/fa";
import { ProModeTab } from "./ProModeTab";

export function OptionsMenu() {
  const state = useSelector((state: RootState) => state.optionsMenu);
  const dispatch = useDispatch();
  return (
    <Modal
      isOpen={state.open}
      onRequestClose={() => dispatch(OptionsState.close())}
    >
      <Nav tabs>
        <NavItem>
          <NavLink
            className={state.currentTab === "mic" ? "active" : ""}
            onClick={() => dispatch(OptionsState.changeTab("mic"))}
          >
            Microphone
          </NavLink>
        </NavItem>
        <NavItem>
          <NavLink
            className={state.currentTab === "stats" ? "active" : ""}
            onClick={() => dispatch(OptionsState.changeTab("stats"))}
          >
            Stream Statistics
          </NavLink>
        </NavItem>
        <NavItem>
          <NavLink
            className={state.currentTab === "pro" ? "active" : ""}
            onClick={() => dispatch(OptionsState.changeTab("pro"))}
          >
            Pro Mode&trade;
          </NavLink>
        </NavItem>
        <NavItem>
          <NavLink
            className={state.currentTab === "midi" ? "active" : ""}
            onClick={() => dispatch(OptionsState.changeTab("midi"))}
          >
            MIDI Control
          </NavLink>
        </NavItem>
        <NavItem>
          <NavLink
            className={state.currentTab === "advanced" ? "active" : ""}
            onClick={() => dispatch(OptionsState.changeTab("advanced"))}
          >
            Advanced Options
          </NavLink>
        </NavItem>
        <NavItem>
          <NavLink
            className={state.currentTab === "about" ? "active" : ""}
            onClick={() => dispatch(OptionsState.changeTab("about"))}
          >
            About
          </NavLink>
        </NavItem>
        <NavItem className="ml-auto">
          <NavLink
            className=" btn-primary active"
            onClick={() => dispatch(OptionsState.close())}
          >
            <FaTimes /> Close
          </NavLink>
        </NavItem>
      </Nav>
      <TabContent activeTab={state.currentTab} className="pt-2">
        <TabPane tabId="mic">
          <MicTab />
        </TabPane>
        <TabPane tabId="stats">
          <StatsTab />
        </TabPane>
        <TabPane tabId="pro">
          <ProModeTab />
        </TabPane>
        <TabPane tabId="midi">
          <MidiTab />
        </TabPane>
        <TabPane tabId="advanced">
          <AdvancedTab />
        </TabPane>
        <TabPane tabId="about">
          <AboutTab />
        </TabPane>
      </TabContent>
    </Modal>
  );
}
