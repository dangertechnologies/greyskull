import React from "react";
import { View } from "react-native";
import { NavigationScreenProps, NavigationState } from "react-navigation";
import { compose } from "recompose";

interface IScreenProps extends NavigationScreenProps<NavigationState> {}

class Screen extends React.Component<IScreenProps> {}

export default compose<IScreenProps, IScreenProps>()(Screen);
