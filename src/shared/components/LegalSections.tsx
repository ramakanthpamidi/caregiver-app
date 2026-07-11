import React from 'react';
import { View, Text } from 'react-native';

export type LegalSection = {
  number: number | string;
  title: string;
  paragraphs?: string[];
  bullets?: string[];
  blocks?: Array<
    | { type: 'paragraph'; text: string }
    | { type: 'subTitle'; text: string }
    | { type: 'bullets'; items: string[] }
  >;
};

type LegalSectionStyles = {
  section: any;
  sectionTitle: any;
  subTitle?: any;
  paragraph: any;
  bulletList: any;
  bulletItem: any;
};

function renderSectionTitlePrefix(num: LegalSection['number']) {
  if (typeof num === 'number') return `${num}.`;
  const raw = String(num).trim();
  // If the prefix is like "2.1" or already ends with punctuation, don't add another dot.
  if (/^\d+(\.\d+)+$/.test(raw)) return raw;
  if (/[.:]$/.test(raw)) return raw;
  return `${raw}.`;
}

export default function LegalSections(props: { sections: LegalSection[]; styles: LegalSectionStyles }) {
  const { sections, styles } = props;

  return (
    <>
      {sections.map((section) => (
        <View key={String(section.number)} style={styles.section}>
          <Text style={styles.sectionTitle}>
            {renderSectionTitlePrefix(section.number)} {section.title}
          </Text>

          {section.blocks?.length
            ? section.blocks.map((block, idx) => {
                if (block.type === 'paragraph') {
                  return (
                    <Text key={`p-${section.number}-${idx}`} style={styles.paragraph}>
                      {block.text}
                    </Text>
                  );
                }

                if (block.type === 'subTitle') {
                  return (
                    <Text key={`s-${section.number}-${idx}`} style={styles.subTitle || styles.paragraph}>
                      {block.text}
                    </Text>
                  );
                }

                if (block.type === 'bullets') {
                  return (
                    <View key={`b-${section.number}-${idx}`} style={styles.bulletList}>
                      {block.items.map((item, itemIdx) => (
                        <Text key={`bi-${section.number}-${idx}-${itemIdx}`} style={styles.bulletItem}>
                          • {item}
                        </Text>
                      ))}
                    </View>
                  );
                }

                return null;
              })
            : null}

          {!section.blocks?.length
            ? section.paragraphs?.map((p, idx) => (
                <Text key={`p-${section.number}-${idx}`} style={styles.paragraph}>
                  {p}
                </Text>
              ))
            : null}

          {!section.blocks?.length && section.bullets?.length ? (
            <View style={styles.bulletList}>
              {section.bullets.map((b, idx) => (
                <Text key={`b-${section.number}-${idx}`} style={styles.bulletItem}>
                  • {b}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      ))}
    </>
  );
}
