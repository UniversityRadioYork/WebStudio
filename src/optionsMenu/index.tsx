import React from "react";
import { Nav, TabContent, TabPane, NavItem, NavLink } from "reactstrap";
import Modal from "react-modal";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../rootReducer";

import * as OptionsState from "./state";
import { MicTab } from "./MicTab";
import { AboutTab } from "./AboutTab";

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
						className={state.currentTab === "about" ? "active" : ""}
						onClick={() => dispatch(OptionsState.changeTab("about"))}
					>
						About
					</NavLink>
				</NavItem>
			</Nav>
			<TabContent activeTab={state.currentTab}>
				<TabPane tabId="mic"><MicTab /></TabPane>
				<TabPane tabId="about"><AboutTab /></TabPane>
			</TabContent>
			<footer>
				<button onClick={() => dispatch(OptionsState.close())}>Exit</button>
			</footer>
		</Modal>
	);
}
