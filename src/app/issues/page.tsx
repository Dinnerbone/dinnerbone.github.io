import { Container } from "@mantine/core";
import { getAllOpenPanics } from "@/app/issues/data";
import { PanicList } from "@/app/issues/panics";

export default async function Page() {
  const { allPanics } = await getAllOpenPanics();
  return (
    <Container size="xl">
      <PanicList allPanics={allPanics} />
    </Container>
  );
}
