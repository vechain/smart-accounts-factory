import { Container, VStack } from "@chakra-ui/react";
import { Home } from "./pages/Home";
import { Navbar } from "./components/Navbar";

function App() {
  return (
    <Container maxW="container.lg" h="full">
      <VStack align="stretch" flex="1" overflowY={"auto"} py={4}>
        <Navbar />
        <Home />
      </VStack>
    </Container>
  );
}

export default App;
