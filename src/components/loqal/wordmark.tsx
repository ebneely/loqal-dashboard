/**
 * The wordmark, as the storefront draws it. There is no logo file: the mark is
 * the word, and the three a's light up green one after another, then rest
 * (`.lq-brandmark-a` in globals.css). Each a is its own span so each can take
 * its own delay; a screen reader and copy-paste still get the one word.
 */
export function Wordmark() {
  return (
    <>
      loq
      <span className="lq-brandmark-a">a</span>
      <span className="lq-brandmark-a">a</span>
      <span className="lq-brandmark-a">a</span>l
    </>
  );
}
