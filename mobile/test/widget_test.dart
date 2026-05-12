import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ameo_mobile/main.dart';

void main() {
  testWidgets('renders Ameo mobile shell', (WidgetTester tester) async {
    await tester.pumpWidget(const AmeoMobileApp());

    expect(find.text('Ameo'), findsOneWidget);
    expect(find.text('Mobile workspace'), findsOneWidget);
    expect(find.byType(TextField), findsNWidgets(4));
  });
}
