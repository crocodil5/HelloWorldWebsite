import React from "react";
import { ActionButtonSection } from "./sections/ActionButtonSection";
import { MainContentSection } from "./sections/MainContentSection";
import { NavigationBarSection } from "./sections/NavigationBarSection";

export const ElementDefault = (): JSX.Element => {
  return (
    <div className="flex flex-col w-full items-center bg-wwwpaypalcomwhite-white-lilac">
      <NavigationBarSection />
      <div className="pt-[88px] w-full">
        <ActionButtonSection />
        <MainContentSection />
      </div>
    </div>
  );
};
