import React from "react";
import { Nav, TabContent, TabPane, NavItem, NavLink } from "reactstrap";
import Modal from "react-modal";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../rootReducer";

import * as OptionsState from "./state";
import { MicTab } from "./MicTab";
import { AboutTab } from "./AboutTab";
import { StatsTab } from "./StatsTab";
import { AdvancedTab } from "./AdvancedTab";

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
      </Nav>
      <TabContent activeTab={state.currentTab}>
        <TabPane tabId="mic">
          <MicTab />
        </TabPane>
        <TabPane tabId="stats">
          <StatsTab />
        </TabPane>
        <TabPane tabId="advanced">
          <AdvancedTab />
        </TabPane>
        <TabPane tabId="about">
          <AboutTab />
        </TabPane>
      </TabContent>
      <footer>
        <button onClick={() => dispatch(OptionsState.close())}>Exit</button>
      </footer>
    </Modal>
  );
}
