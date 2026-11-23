import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { PhotoPicker } from "./PhotoPicker";
import { PhotoGallery } from "./PhotoGallery";
import { RecipeForm } from "./RecipeForm";

function Harness({ upload, initial = [] as string[] }: { upload?: (f: File) => Promise<string>; initial?: string[] }) {
  const [photos, setPhotos] = useState(initial);
  return <PhotoPicker photos={photos} onChange={setPhotos} upload={upload} />;
}

const jpg = (name = "dish.jpg") => new File(["x"], name, { type: "image/jpeg" });
const photoAlts = () => within(screen.getByRole("list", { name: "Recipe photos" })).queryAllByRole("img").map((i) => i.getAttribute("src"));

describe("PhotoPicker", () => {
  it("uploads several picked photos in order", async () => {
    const upload = vi.fn(async (f: File) => `stored/${f.name}`);
    render(<Harness upload={upload} />);
    await userEvent.upload(screen.getByLabelText("Choose photos"), [jpg("a.jpg"), jpg("b.jpg")]);
    await waitFor(() => expect(photoAlts()).toEqual(["stored/a.jpg", "stored/b.jpg"]));
    expect(screen.getByText("Cover")).toBeInTheDocument();
  });

  it("makes a photo the cover and removes photos", async () => {
    const user = userEvent.setup();
    render(<Harness initial={["one", "two", "three"]} />);
    await user.click(screen.getByRole("button", { name: "Make photo 3 the cover" }));
    expect(photoAlts()).toEqual(["three", "one", "two"]);
    await user.click(screen.getByRole("button", { name: "Remove photo 2" }));
    expect(photoAlts()).toEqual(["three", "two"]);
  });

  it("adds a photo by link and rejects bad links", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByLabelText("Picture link"), "not a link{enter}");
    expect(screen.getByRole("alert")).toHaveTextContent(/https/);
    await user.clear(screen.getByLabelText("Picture link"));
    await user.type(screen.getByLabelText("Picture link"), "https://example.com/pie.jpg{enter}");
    expect(photoAlts()).toEqual(["https://example.com/pie.jpg"]);
  });

  it("explains non-picture files and upload failures", async () => {
    const upload = vi.fn().mockRejectedValue(new Error("This device's storage is full."));
    render(<Harness upload={upload} />);
    // applyAccept: false lets the test pick a file the real picker would hide.
    await userEvent.setup({ applyAccept: false }).upload(screen.getByLabelText("Choose photos"), new File(["x"], "recipe.pdf", { type: "application/pdf" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("isn't a picture");
    await userEvent.upload(screen.getByLabelText("Choose photos"), jpg());
    expect(await screen.findByText(/storage is full/)).toBeInTheDocument();
  });

  it("only offers links when uploading isn't available", () => {
    render(<Harness />);
    expect(screen.queryByLabelText("Choose photos")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Picture link")).toBeInTheDocument();
  });
});

describe("PhotoGallery", () => {
  it("opens photos full screen and moves between them", async () => {
    const user = userEvent.setup();
    render(<PhotoGallery photos={["a.jpg", "b.jpg", "c.jpg"]} title="Pie" />);
    await user.click(screen.getByRole("button", { name: "View photo 3 of 3" }));
    expect(screen.getByRole("dialog", { name: "Photo 3 of 3" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next photo" }));
    expect(screen.getByRole("dialog", { name: "Photo 1 of 3" })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(screen.getByRole("dialog", { name: "Photo 3 of 3" })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders nothing without photos", () => {
    const { container } = render(<PhotoGallery photos={[]} title="Pie" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("RecipeForm photos", () => {
  it("saves uploaded photos with the recipe, first as the cover", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<RecipeForm onSubmit={onSubmit} uploadPhoto={async (f) => `stored/${f.name}`} />);
    await user.type(screen.getByLabelText("Recipe name"), "Pie");
    await user.type(screen.getByLabelText(/steps — one per line/i), "Bake it.");
    await user.upload(screen.getByLabelText("Choose photos"), [jpg("top.jpg"), jpg("slice.jpg")]);
    await waitFor(() => expect(photoAlts()).toHaveLength(2));
    await user.click(screen.getByRole("button", { name: "Save recipe" }));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ imageUrl: "stored/top.jpg", photos: ["stored/top.jpg", "stored/slice.jpg"] });
  });
});
