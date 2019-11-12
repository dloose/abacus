import React from "react";
import AddSymbol from "./AddSymbol";
import SymbolDropdown from "./SymbolDropdown";
import SymbolGraph from "./SymbolGraph";

export default class App extends React.Component {
    state = {
        newSymbol: "",
        selectedSymbol: null,
    };

    handleSymbolChange = (selectedSymbol) => {
        this.setState({selectedSymbol});
    };

    render() {
        return (
            <div className="App">
                <SymbolDropdown selectedSymbol={this.state.selectedSymbol} onSymbolChange={this.handleSymbolChange}/>
                <SymbolGraph symbol={this.state.selectedSymbol}/>
                <AddSymbol/>
            </div>
        );
    }
}